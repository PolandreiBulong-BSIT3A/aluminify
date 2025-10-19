# alumify_analytics_pro.py
"""
Alumify Analytics PRO
- Enhanced analytics dashboard for the Alumify SQL schema.
- Top filter bar, KPI cards (responsive), mixed chart types, counts + percentages,
  insights below charts, filtered CSV/Excel export.
- Fixed st.experimental_rerun() deprecation issue
- Enhanced comparison functionality for multiple datasets
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from sqlalchemy import create_engine
from datetime import datetime, timedelta
import re
from typing import Dict, Any, Optional, Tuple
import io

# ---------------------------
# Config & Styling
# ---------------------------
st.set_page_config(page_title="Alumify Analytics PRO", layout="wide", page_icon="🎓")
COLOR_PALETTE = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
]

st.markdown(
    """
    <style>
        /* Header */
        .main-header { font-size: 2.2rem; color: #1f77b4; text-align:center; margin-bottom:2px; font-weight:700; }
        .sub-header { font-size:1rem; color:#6c757d; text-align:center; margin-bottom:12px; }

        /* Top filter bar */
        .filter-bar { background:#f2f4f7; padding:12px; border-radius:8px; margin-bottom:14px; }
        .filter-item { margin-right:12px; }

        /* KPI card */
        .kpi-card { background: #ffffff; padding:12px; border-radius:10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .kpi-title { color:#6c757d; font-size:0.95rem; margin-bottom:6px; }
        .kpi-value { color:#111827; font-weight:700; font-size:1.3rem; }

        /* story section */
        .story-section { background:#ffffff; padding:14px; border-radius:8px; margin-bottom:12px; border:1px solid #e9ecef; }
        .section-header { color:#1f77b4; border-bottom:2px solid #e9ecef; padding-bottom:6px; margin-bottom:10px; }

        /* insight text */
        .insight { background:#f8fafc; padding:10px; border-left:3px solid #1f77b4; border-radius:6px; color:#2b2b2b; }
        
        /* comparison highlight */
        .comparison-highlight { background:#e3f2fd; padding:8px; border-radius:4px; margin:4px 0; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------
# DB connection
# ---------------------------
@st.cache_resource
def get_engine():
    # modify the connection string / credentials if needed
    return create_engine("mysql+pymysql://root:@127.0.0.1:3306/alumify")

# ---------------------------
# Load data (cached)
# ---------------------------
@st.cache_data(ttl=60)
def load_all() -> Dict[str, pd.DataFrame]:
    engine = get_engine()
    tables = [
        "users",
        "graduate_profiles",
        "educational_background",
        "employment_data",
        "survey_responses",
        "activity_logs",
        "useful_competencies",
        "course_reasons",
        "unemployment_reasons",
        "curriculum_suggestions"
    ]
    dfs: Dict[str, pd.DataFrame] = {}
    for t in tables:
        try:
            dfs[t] = pd.read_sql(f"SELECT * FROM {t}", con=engine)
        except Exception:
            dfs[t] = pd.DataFrame()
    # Minor normalization and derived fields
    if not dfs["graduate_profiles"].empty and "birthday" in dfs["graduate_profiles"].columns:
        dfs["graduate_profiles"]["birthday"] = pd.to_datetime(dfs["graduate_profiles"]["birthday"], errors="coerce")
        dfs["graduate_profiles"]["age"] = (pd.to_datetime("today") - dfs["graduate_profiles"]["birthday"]).dt.days // 365
    # Normalize year_graduated to string for filters
    if not dfs["educational_background"].empty and "year_graduated" in dfs["educational_background"].columns:
        dfs["educational_background"]["year_graduated"] = dfs["educational_background"]["year_graduated"].astype(str).replace("nan", "")
    return dfs

# ---------------------------
# Utility helpers
# ---------------------------
def safe_count_series(series: pd.Series) -> pd.Series:
    if series is None or series.empty:
        return pd.Series(dtype=int)
    return series.dropna().astype(str).value_counts()

def counts_and_percents(series: pd.Series) -> pd.DataFrame:
    counts = safe_count_series(series)
    if counts.empty:
        return pd.DataFrame(columns=["Count", "Percent"])
    perc = (counts / counts.sum() * 100).round(1)
    df = pd.DataFrame({"Count": counts.astype(int), "Percent": perc})
    return df

def parse_salary_lower_bound(s: str) -> Optional[float]:
    # try to extract numerical lower bound from strings like "P5,000.00 to less than P10,000.00"
    if not isinstance(s, str):
        return None
    # find first number (allow commas/decimals)
    nums = re.findall(r'[\d,]+(?:\.d+)?', s.replace('P', '').strip())
    if not nums:
        return None
    try:
        return float(nums[0].replace(",", ""))
    except Exception:
        return None

def top_n_words(texts: pd.Series, n: int = 10) -> pd.Series:
    if texts is None or texts.empty:
        return pd.Series(dtype=int)
    words = {}
    for t in texts.dropna().astype(str):
        tokens = re.findall(r'\b[a-zA-Z]{2,}\b', t.lower())
        for tk in tokens:
            words[tk] = words.get(tk, 0) + 1
    if not words:
        return pd.Series(dtype=int)
    s = pd.Series(words).sort_values(ascending=False)
    return s.head(n)

def fmt_count_percent(count: int, total: int) -> str:
    pct = (count / total * 100) if total > 0 else 0
    return f"{count:,} ({pct:.0f}%)"

def chart_label_with_counts(series: pd.Series) -> pd.Series:
    """Return labels as 'label — count (pct%)' """
    counts = safe_count_series(series)
    total = counts.sum()
    labels = [f"{idx} — {counts[idx]:,} ({int(round(counts[idx]/total*100))}%)" for idx in counts.index]
    return pd.Series(data=counts.values, index=labels)

def enforce_int_ticks(fig: go.Figure):
    # Try to set integer tick formatting where relevant and black text
    fig.update_layout(font=dict(color="black"))
    # many plotly traces will use integer ticks automatically, but we force textfont
    for trace in fig.data:
        # set textfont color
        if hasattr(trace, "marker"):
            try:
                trace.textfont = dict(color="black")
            except Exception:
                pass
    return fig

# ---------------------------
# Top filter bar (horizontal)
# ---------------------------
def top_filter_bar(dfs: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
    # Extract options from data
    edu = dfs.get("educational_background", pd.DataFrame())
    gp = dfs.get("graduate_profiles", pd.DataFrame())

    years = ["All"]
    if not edu.empty and any("year_graduated" in c.lower() for c in edu.columns):
        col = [c for c in edu.columns if "year_graduated" in c.lower()][0]
        yrs = sorted(edu[col].dropna().astype(str).unique())
        years = ["All"] + yrs

    programs = ["All"]
    if not edu.empty and any("degree" in c.lower() for c in edu.columns):
        col = [c for c in edu.columns if "degree" in c.lower()][0]
        progs = sorted(edu[col].dropna().astype(str).unique())
        programs = ["All"] + progs

    genders = ["All"]
    if not gp.empty and any(c.lower().startswith("sex") or "gender" in c.lower() for c in gp.columns):
        sex_col = [c for c in gp.columns if c.lower().startswith("sex") or "gender" in c.lower()][0]
        gop = sorted(gp[sex_col].dropna().astype(str).unique())
        genders = ["All"] + gop

    # Layout: a container with light gray background (implemented with raw HTML + columns)
    st.markdown('<div class="filter-bar">', unsafe_allow_html=True)
    cols = st.columns([1.2, 1.2, 1.2, 0.8, 0.8])
    with cols[0]:
        year = st.selectbox("Graduation Year", options=years, index=0)
    with cols[1]:
        program = st.selectbox("Degree Program", options=programs, index=0)
    with cols[2]:
        gender = st.selectbox("Gender", options=genders, index=0)
    with cols[3]:
        compare_by = st.selectbox("Compare By", options=["None", "Program", "Gender", "Graduation Year", "Employment Status"], index=0)
    with cols[4]:
        if st.button("Reset Filters"):
            st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

    return {"year": year, "program": program, "gender": gender, "compare_by": compare_by}

# ---------------------------
# Filter application
# ---------------------------
def apply_filters(dfs: Dict[str, pd.DataFrame], filters: Dict[str, Any]) -> Dict[str, pd.DataFrame]:
    """Filter each relevant table by selected filters (year, program, gender). Returns filtered tables dict."""
    edu = dfs.get("educational_background", pd.DataFrame()).copy()
    gp = dfs.get("graduate_profiles", pd.DataFrame()).copy()
    emp = dfs.get("employment_data", pd.DataFrame()).copy()
    users = dfs.get("users", pd.DataFrame()).copy()
    activity = dfs.get("activity_logs", pd.DataFrame()).copy()
    others = {k: v.copy() for k, v in dfs.items() if k not in ("educational_background", "graduate_profiles", "employment_data", "users", "activity_logs")}

    # We'll derive user_ids that match selected program / year / gender
    user_sets = []

    # Program filter
    if filters.get("program") and filters["program"] != "All" and not edu.empty:
        deg_col = [c for c in edu.columns if "degree" in c.lower()][0]
        matched = edu[edu[deg_col].astype(str) == filters["program"]]
        if "user_id" in matched.columns:
            user_sets.append(set(matched["user_id"].astype(int).unique()))

    # Year filter
    if filters.get("year") and filters["year"] != "All" and not edu.empty:
        yr_col = [c for c in edu.columns if "year_graduated" in c.lower()][0]
        matched = edu[edu[yr_col].astype(str) == filters["year"]]
        if "user_id" in matched.columns:
            user_sets.append(set(matched["user_id"].astype(int).unique()))

    # Gender filter
    if filters.get("gender") and filters["gender"] != "All" and not gp.empty:
        sex_col = [c for c in gp.columns if c.lower().startswith("sex") or "gender" in c.lower()][0]
        matched = gp[gp[sex_col].astype(str) == filters["gender"]]
        if "user_id" in matched.columns:
            user_sets.append(set(matched["user_id"].astype(int).unique()))

    # Combine user id sets - intersection if multiple filters, else union or all
    if user_sets:
        user_ids = set.intersection(*user_sets) if len(user_sets) > 1 else user_sets[0]
    else:
        # all users if users table present
        user_ids = set(users["id"].astype(int).unique()) if not users.empty and "id" in users.columns else set()

    def filter_by_userid(df):
        if df.empty:
            return df
        if "user_id" in df.columns:
            if user_ids:
                return df[df["user_id"].astype(int).isin(user_ids)].copy()
            else:
                # if filters were active but no matched users -> return empty
                any_filter_active = any([filters.get("program") != "All", filters.get("year") != "All", filters.get("gender") != "All"])
                return df[df["user_id"].astype(int).isin([])].copy() if any_filter_active else df.copy()
        return df.copy()

    filtered: Dict[str, pd.DataFrame] = {}
    for k, df in dfs.items():
        if df.empty:
            filtered[k] = df.copy()
            continue
        filtered[k] = filter_by_userid(df)

    # activity_logs date filter/support isn't included in top-bar (kept as-is)
    return filtered

def create_comparison_datasets(dfs: Dict[str, pd.DataFrame], compare_by: str) -> Dict[str, Dict[str, pd.DataFrame]]:
    """Create separate filtered datasets for comparison based on the compare_by parameter."""
    if compare_by == "None":
        return {}
    
    comparison_datasets = {}
    edu = dfs.get("educational_background", pd.DataFrame())
    gp = dfs.get("graduate_profiles", pd.DataFrame())
    emp = dfs.get("employment_data", pd.DataFrame())
    
    if compare_by == "Program" and not edu.empty:
        deg_col = [c for c in edu.columns if "degree" in c.lower()][0]
        programs = edu[deg_col].dropna().unique()
        for program in programs:
            filters = {"program": program, "year": "All", "gender": "All"}
            comparison_datasets[f"Program: {program}"] = apply_filters(dfs, filters)
    
    elif compare_by == "Gender" and not gp.empty:
        sex_col = [c for c in gp.columns if c.lower().startswith("sex") or "gender" in c.lower()][0]
        genders = gp[sex_col].dropna().unique()
        for gender in genders:
            filters = {"program": "All", "year": "All", "gender": gender}
            comparison_datasets[f"Gender: {gender}"] = apply_filters(dfs, filters)
    
    elif compare_by == "Graduation Year" and not edu.empty:
        yr_col = [c for c in edu.columns if "year_graduated" in c.lower()][0]
        years = edu[yr_col].dropna().astype(str).unique()
        for year in sorted(years)[-5:]:  # Last 5 years for comparison
            filters = {"program": "All", "year": year, "gender": "All"}
            comparison_datasets[f"Year: {year}"] = apply_filters(dfs, filters)
    
    elif compare_by == "Employment Status" and not emp.empty:
        emp_col = next((c for c in emp.columns if "is_employed" in c.lower() or "employment_status" in c.lower()), None)
        if emp_col:
            statuses = emp[emp_col].dropna().unique()
            for status in statuses:
                # Filter by employment status
                emp_filtered = emp[emp[emp_col] == status]
                user_ids = set(emp_filtered["user_id"].astype(int).unique()) if "user_id" in emp_filtered.columns else set()
                
                # Create filtered dataset for this employment status
                filtered_dfs = {}
                for k, df in dfs.items():
                    if df.empty:
                        filtered_dfs[k] = df.copy()
                        continue
                    if "user_id" in df.columns and user_ids:
                        filtered_dfs[k] = df[df["user_id"].astype(int).isin(user_ids)].copy()
                    else:
                        filtered_dfs[k] = df.copy()
                
                comparison_datasets[f"Employment: {status}"] = filtered_dfs
    
    return comparison_datasets

# ---------------------------
# KPI cards (responsive grid)
# ---------------------------
def show_kpis(filtered: Dict[str, pd.DataFrame], comparison_datasets: Dict[str, Dict[str, pd.DataFrame]] = None):
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">📊 Key Metrics</h3>', unsafe_allow_html=True)

    users = filtered.get("users", pd.DataFrame())
    edu = filtered.get("educational_background", pd.DataFrame())
    emp = filtered.get("employment_data", pd.DataFrame())
    surveys = filtered.get("survey_responses", pd.DataFrame())

    total_alumni = len(users) if not users.empty else 0
    total_graduates = len(edu) if not edu.empty else 0

    # Employment rate
    emp_rate = None
    if not emp.empty:
        emp_col = next((c for c in emp.columns if "is_employed" in c.lower() or "employment_status" in c.lower()), None)
        if emp_col:
            s = emp[emp_col].astype(str).str.lower().map(lambda x: 1 if "yes" in x or "employed" in x else 0)
            if not s.empty:
                emp_rate = (s.mean() * 100)

    # Average parsed salary (if exists)
    avg_salary = None
    salary_col = None
    if not emp.empty:
        for c in emp.columns:
            if "initial_gross" in c.lower() or "salary" in c.lower() or "earning" in c.lower():
                salary_col = c
                break
    if salary_col:
        emp["salary_lower"] = emp[salary_col].apply(parse_salary_lower_bound)
        if not emp["salary_lower"].dropna().empty:
            avg_salary = emp["salary_lower"].median()

    # Responsive grid: 4 per row on wide, will wrap on small screens
    cols = st.columns([1,1,1,1])
    # Card 1
    with cols[0]:
        st.markdown('<div class="kpi-card">', unsafe_allow_html=True)
        st.markdown('<div class="kpi-title">Graduates in view</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{total_graduates:,}</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
    # Card 2
    with cols[1]:
        st.markdown('<div class="kpi-card">', unsafe_allow_html=True)
        st.markdown('<div class="kpi-title">Registered Alumni</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{total_alumni:,}</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
    # Card 3
    with cols[2]:
        st.markdown('<div class="kpi-card">', unsafe_allow_html=True)
        st.markdown('<div class="kpi-title">Employment Rate</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{(f"{emp_rate:.0f}%" if emp_rate is not None and not np.isnan(emp_rate) else "N/A")}</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
    # Card 4
    with cols[3]:
        st.markdown('<div class="kpi-card">', unsafe_allow_html=True)
        st.markdown('<div class="kpi-title">Median salary (parsed)</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{(f"₱{int(avg_salary):,}" if avg_salary is not None else "N/A")}</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    if comparison_datasets:
        st.markdown("### 📊 Comparison Metrics")
        comparison_metrics = []
        
        for dataset_name, dataset in comparison_datasets.items():
            emp_data = dataset.get("employment_data", pd.DataFrame())
            if not emp_data.empty:
                emp_col = next((c for c in emp_data.columns if "is_employed" in c.lower() or "employment_status" in c.lower()), None)
                if emp_col:
                    s = emp_data[emp_col].astype(str).str.lower().map(lambda x: 1 if "yes" in x or "employed" in x else 0)
                    if not s.empty:
                        emp_rate_comp = s.mean() * 100
                        comparison_metrics.append({
                            "Dataset": dataset_name,
                            "Graduates": len(dataset.get("educational_background", pd.DataFrame())),
                            "Employment Rate": f"{emp_rate_comp:.1f}%"
                        })
        
        if comparison_metrics:
            comp_df = pd.DataFrame(comparison_metrics)
            st.dataframe(comp_df, use_container_width=True)

    st.markdown('</div>', unsafe_allow_html=True)

# ---------------------------
# Visualizations & Insights
# ---------------------------
def visualize_demographics(filtered: Dict[str, pd.DataFrame], compare_by: str, comparison_datasets: Dict[str, Dict[str, pd.DataFrame]] = None):
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">👥 Demographics</h3>', unsafe_allow_html=True)

    gp = filtered.get("graduate_profiles", pd.DataFrame())
    if gp.empty:
        st.info("No graduate profile data available to show demographics.")
        st.markdown('</div>', unsafe_allow_html=True)
        return

    # Determine gender column
    sex_cols = [c for c in gp.columns if c.lower().startswith("sex") or "gender" in c.lower()]
    sex_col = sex_cols[0] if sex_cols else None

    col1, col2 = st.columns(2)
    with col1:
        if sex_col:
            dfp = counts_and_percents(gp[sex_col])
            if dfp.empty:
                st.info("No gender data.")
            else:
                labels = [f"{idx} — {dfp.loc[idx,'Count']:,} ({int(round(dfp.loc[idx,'Percent']))}%)" for idx in dfp.index]
                fig = px.pie(values=dfp["Count"].values, names=labels, hole=0.35, color_discrete_sequence=COLOR_PALETTE)
                fig.update_traces(textinfo="none")  # label already contains counts
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)
                st.markdown(f'<div class="insight">Most common gender: <b>{dfp["Count"].idxmax()}</b> — {dfp["Count"].max():,} ({dfp["Percent"].max():.0f}%).</div>', unsafe_allow_html=True)
        else:
            st.info("No gender field available")

    with col2:
        cs_cols = [c for c in gp.columns if "civil_status" in c.lower()]
        cs_col = cs_cols[0] if cs_cols else None
        if cs_col:
            dfc = counts_and_percents(gp[cs_col])
            if dfc.empty:
                st.info("No civil status data.")
            else:
                labels = [f"{idx} — {dfc.loc[idx,'Count']:,} ({int(round(dfc.loc[idx,'Percent']))}%)" for idx in dfc.index]
                fig = px.pie(values=dfc["Count"].values, names=labels, hole=0.5, color_discrete_sequence=COLOR_PALETTE)
                fig.update_traces(textinfo="none")
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)
                st.markdown(f'<div class="insight">Most common civil status: <b>{dfc["Count"].idxmax()}</b> — {dfc["Count"].max():,} ({dfc["Percent"].max():.0f}%).</div>', unsafe_allow_html=True)
        else:
            st.info("No civil status column")

    if comparison_datasets and compare_by != "Gender":  # Don't compare gender by gender
        st.markdown("### 📊 Gender Distribution Comparison")
        if sex_col:
            comparison_data = []
            for dataset_name, dataset in comparison_datasets.items():
                gp_comp = dataset.get("graduate_profiles", pd.DataFrame())
                if not gp_comp.empty and sex_col in gp_comp.columns:
                    gender_counts = gp_comp[sex_col].value_counts()
                    for gender, count in gender_counts.items():
                        comparison_data.append({
                            "Dataset": dataset_name,
                            "Gender": gender,
                            "Count": count
                        })
            
            if comparison_data:
                comp_df = pd.DataFrame(comparison_data)
                fig = px.bar(comp_df, x="Dataset", y="Count", color="Gender", 
                           title="Gender Distribution Across Datasets")
                fig.update_layout(xaxis_tickangle=-45)
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)

    st.markdown('</div>', unsafe_allow_html=True)

def visualize_education(filtered: Dict[str, pd.DataFrame], compare_by: str, comparison_datasets: Dict[str, Dict[str, pd.DataFrame]] = None):
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">🎓 Education</h3>', unsafe_allow_html=True)

    edu = filtered.get("educational_background", pd.DataFrame())
    if edu.empty:
        st.info("No educational background records available.")
        st.markdown('</div>', unsafe_allow_html=True)
        return

    # Degree treemap + graduation trend
    degree_col = next((c for c in edu.columns if "degree" in c.lower()), None)
    year_col = next((c for c in edu.columns if "year_graduated" in c.lower()), None)

    c1, c2 = st.columns(2)
    with c1:
        if degree_col:
            deg_counts = edu[degree_col].fillna("Unknown").astype(str).value_counts()
            if deg_counts.empty:
                st.info("No degree data.")
            else:
                labels = [f"{idx} — {deg_counts[idx]:,} ({int(round(deg_counts[idx]/deg_counts.sum()*100))}%)" for idx in deg_counts.index]
                fig = px.treemap(names=deg_counts.index, parents=[""]*len(deg_counts), values=deg_counts.values, hover_data=[deg_counts.values])
                fig.update_traces(textinfo="label+value")
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)
                top = deg_counts.idxmax()
                st.markdown(f'<div class="insight">Top program: <b>{top}</b> — {deg_counts.max():,} graduates ({int(round(deg_counts.max()/deg_counts.sum()*100))}%).</div>', unsafe_allow_html=True)
        else:
            st.info("No degree column found.")

    with c2:
        if year_col:
            yc = edu[year_col].replace("", np.nan).dropna().astype(str).value_counts().sort_index()
            if yc.empty:
                st.info("No graduation year data.")
            else:
                fig = px.line(x=yc.index, y=yc.values, markers=True)
                fig.update_layout(xaxis_title="Graduation Year", yaxis_title="Count", font=dict(color="black"))
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)
                peak = yc.idxmax()
                st.markdown(f'<div class="insight">Peak graduation year: <b>{peak}</b> — {yc.max():,} graduates.</div>', unsafe_allow_html=True)
        else:
            st.info("No graduation year column found.")

    if comparison_datasets and compare_by not in ["Program", "Graduation Year"]:
        st.markdown("### 📊 Program Distribution Comparison")
        if degree_col:
            comparison_data = []
            for dataset_name, dataset in comparison_datasets.items():
                edu_comp = dataset.get("educational_background", pd.DataFrame())
                if not edu_comp.empty and degree_col in edu_comp.columns:
                    program_counts = edu_comp[degree_col].value_counts().head(5)  # Top 5 programs
                    for program, count in program_counts.items():
                        comparison_data.append({
                            "Dataset": dataset_name,
                            "Program": program,
                            "Count": count
                        })
            
            if comparison_data:
                comp_df = pd.DataFrame(comparison_data)
                fig = px.bar(comp_df, x="Dataset", y="Count", color="Program", 
                           title="Top Programs Across Datasets")
                fig.update_layout(xaxis_tickangle=-45)
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)

    st.markdown('</div>', unsafe_allow_html=True)

def visualize_employment(filtered: Dict[str, pd.DataFrame], compare_by: str, comparison_datasets: Dict[str, Dict[str, pd.DataFrame]] = None):
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">💼 Employment & Careers</h3>', unsafe_allow_html=True)

    emp = filtered.get("employment_data", pd.DataFrame())
    if emp.empty:
        st.info("No employment data available.")
        st.markdown('</div>', unsafe_allow_html=True)
        return

    is_emp_col = next((c for c in emp.columns if "is_employed" in c.lower()), None)
    business_col = next((c for c in emp.columns if "business_line" in c.lower()), None)
    occ_col = next((c for c in emp.columns if "present_occupation" in c.lower()), None)
    salary_col = next((c for c in emp.columns if "initial_gross" in c.lower() or "salary" in c.lower() or "earning" in c.lower()), None)

    c1, c2 = st.columns(2)
    with c1:
        if is_emp_col:
            s = counts_and_percents(emp[is_emp_col])
            if s.empty:
                st.info("No employment status values.")
            else:
                labels = [f"{idx} — {s.loc[idx,'Count']:,} ({int(round(s.loc[idx,'Percent']))}%)" for idx in s.index]
                fig = px.funnel(x=s["Count"].values, y=labels)
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)
                top = s["Count"].idxmax()
                st.markdown(f'<div class="insight">Most common employment status: <b>{top}</b> — {s["Count"].max():,} ({s["Percent"].max():.0f}%).</div>', unsafe_allow_html=True)
        else:
            st.info("No is_employed/employment_status column found.")

    with c2:
        if business_col:
            b = emp[business_col].fillna("Unknown").astype(str).value_counts().head(12)
            if b.empty:
                st.info("No industry data.")
            else:
                labels = [f"{idx} — {b[idx]:,} ({int(round(b[idx]/b.sum()*100))}%)" for idx in b.index]
                fig = px.bar(x=b.values, y=labels, orientation='h')
                fig.update_traces(texttemplate="%{x:.0f}", textposition="outside")
                enforce_int_ticks(fig)
                st.plotly_chart(fig, use_container_width=True)
                st.markdown(f'<div class="insight">Top industry: <b>{b.idxmax()}</b> — {b.max():,} alumni.</div>', unsafe_allow_html=True)
        else:
            st.info("No industry/business_line field present.")

    if comparison_datasets:
        st.markdown("### 📊 Employment Rate Comparison")
        comparison_data = []
        for dataset_name, dataset in comparison_datasets.items():
            emp_comp = dataset.get("employment_data", pd.DataFrame())
            if not emp_comp.empty and is_emp_col and is_emp_col in emp_comp.columns:
                s = emp_comp[is_emp_col].astype(str).str.lower().map(lambda x: 1 if "yes" in x or "employed" in x else 0)
                if not s.empty:
                    emp_rate = s.mean() * 100
                    comparison_data.append({
                        "Dataset": dataset_name,
                        "Employment Rate": emp_rate,
                        "Total Graduates": len(emp_comp)
                    })
        
        if comparison_data:
            comp_df = pd.DataFrame(comparison_data)
            fig = px.bar(comp_df, x="Dataset", y="Employment Rate", 
                        title="Employment Rate Comparison",
                        text="Employment Rate")
            fig.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
            fig.update_layout(xaxis_tickangle=-45, yaxis_title="Employment Rate (%)")
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
            
            # Highlight best and worst performing groups
            if len(comp_df) > 1:
                best = comp_df.loc[comp_df["Employment Rate"].idxmax()]
                worst = comp_df.loc[comp_df["Employment Rate"].idxmin()]
                st.markdown(f'<div class="comparison-highlight">🏆 <b>Highest Employment Rate:</b> {best["Dataset"]} ({best["Employment Rate"]:.1f}%)</div>', unsafe_allow_html=True)
                st.markdown(f'<div class="comparison-highlight">📉 <b>Lowest Employment Rate:</b> {worst["Dataset"]} ({worst["Employment Rate"]:.1f}%)</div>', unsafe_allow_html=True)

    # Occupations and salaries (below)
    st.markdown("---")
    st.markdown("**Occupation & Salary (parsed)**")
    occ_col_local = occ_col
    if occ_col_local and occ_col_local in emp.columns:
        top_occ = emp[occ_col_local].fillna("Unknown").astype(str).value_counts().head(10)
        if not top_occ.empty:
            labels = [f"{idx} — {top_occ[idx]:,} ({int(round(top_occ[idx]/top_occ.sum()*100))}%)" for idx in top_occ.index]
            fig = px.bar(x=top_occ.values, y=labels, orientation='h')
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
    if salary_col and salary_col in emp.columns:
        emp["salary_lower"] = emp[salary_col].apply(parse_salary_lower_bound)
        if not emp["salary_lower"].dropna().empty:
            median_salary = emp["salary_lower"].median()
            fig = px.histogram(emp, x="salary_lower", nbins=12)
            fig.update_layout(xaxis_title="Parsed salary (lower bound)", yaxis_title="Count")
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
            st.markdown(f'<div class="insight">Estimated median lower-bound salary: <b>₱{median_salary:,.0f}</b> (parsed).</div>', unsafe_allow_html=True)
        else:
            st.info("Salary field present but not parseable into numeric values for summary.")
    st.markdown('</div>', unsafe_allow_html=True)

def visualize_engagement(filtered: Dict[str, pd.DataFrame]):
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">📈 Engagement</h3>', unsafe_allow_html=True)

    act = filtered.get("activity_logs", pd.DataFrame())
    if act.empty or "created_at" not in act.columns:
        st.info("No engagement/activity logs available.")
        st.markdown('</div>', unsafe_allow_html=True)
        return

    act = act.copy()
    act["created_at_dt"] = pd.to_datetime(act["created_at"], errors="coerce")
    act["date"] = act["created_at_dt"].dt.date
    daily = act["date"].value_counts().sort_index()
    if not daily.empty:
        fig = px.area(x=daily.index, y=daily.values, title="Daily Engagement Activity")
        fig.update_layout(xaxis_title="Date", yaxis_title="Activities")
        enforce_int_ticks(fig)
        st.plotly_chart(fig, use_container_width=True)
        st.markdown(f'<div class="insight">Total activity records in range: <b>{daily.sum():,}</b>. Highest day: <b>{daily.idxmax()}</b> — {daily.max():,} activities.</div>', unsafe_allow_html=True)
    else:
        st.info("No engagement within selected range")

    if "activity_type" in act.columns:
        types = counts_and_percents(act["activity_type"])
        if not types.empty:
            labels = [f"{idx} — {types.loc[idx,'Count']:,} ({int(round(types.loc[idx,'Percent']))}%)" for idx in types.index]
            fig = px.pie(values=types["Count"].values, names=labels, hole=0.3)
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
    st.markdown('</div>', unsafe_allow_html=True)

def visualize_competencies_and_texts(filtered: Dict[str, pd.DataFrame]):
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">🛠 Competencies & Open Feedback</h3>', unsafe_allow_html=True)

    comps = filtered.get("useful_competencies", pd.DataFrame())
    course_reasons = filtered.get("course_reasons", pd.DataFrame())
    unem_reasons = filtered.get("unemployment_reasons", pd.DataFrame())
    suggestions = filtered.get("curriculum_suggestions", pd.DataFrame())

    if not comps.empty and "competency" in comps.columns:
        top_comp = comps["competency"].value_counts().head(10)
        if not top_comp.empty:
            labels = [f"{idx} — {top_comp[idx]:,} ({int(round(top_comp[idx]/top_comp.sum()*100))}%)" for idx in top_comp.index]
            fig = px.bar(x=top_comp.values, y=labels, orientation='h')
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
            st.markdown(f'<div class="insight">Top competency: <b>{top_comp.idxmax()}</b> — {top_comp.max():,} mentions.</div>', unsafe_allow_html=True)
    else:
        st.info("No competency entries.")

    st.markdown("**Reasons for choosing course (top)**")
    if not course_reasons.empty and "reason_type" in course_reasons.columns:
        rr = course_reasons["reason_type"].value_counts().head(10)
        if not rr.empty:
            labels = [f"{idx} — {rr[idx]:,}" for idx in rr.index]
            fig = px.bar(x=rr.values, y=labels, orientation='h')
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No course reason data")

    st.markdown("**Unemployment Reasons (top)**")
    if not unem_reasons.empty and "reason" in unem_reasons.columns:
        ur = unem_reasons["reason"].value_counts().head(10)
        if not ur.empty:
            labels = [f"{idx} — {ur[idx]:,}" for idx in ur.index]
            fig = px.bar(x=ur.values, y=labels, orientation='h')
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No unemployment reasons")

    st.markdown("**Curriculum Suggestions - Top words**")
    if not suggestions.empty and "suggestion" in suggestions.columns:
        tw = top_n_words(suggestions["suggestion"].dropna().astype(str), n=15)
        if not tw.empty:
            labels = [f"{idx} — {tw[idx]:,}" for idx in tw.index]
            fig = px.bar(x=tw.values, y=labels, orientation='h')
            enforce_int_ticks(fig)
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No curriculum suggestions text")

    st.markdown('</div>', unsafe_allow_html=True)

# ---------------------------
# Insights generator
# ---------------------------
def generate_insights(filtered: Dict[str, pd.DataFrame], compare_by: str, comparison_datasets: Dict[str, Dict[str, pd.DataFrame]] = None) -> list:
    insights = []
    edu = filtered.get("educational_background", pd.DataFrame())
    emp = filtered.get("employment_data", pd.DataFrame())
    gp = filtered.get("graduate_profiles", pd.DataFrame())
    surveys = filtered.get("survey_responses", pd.DataFrame())
    comps = filtered.get("useful_competencies", pd.DataFrame())

    # employment insight
    if not emp.empty:
        is_emp_col = next((c for c in emp.columns if "is_employed" in c.lower() or "employment_status" in c.lower()), None)
        if is_emp_col:
            s = emp[is_emp_col].astype(str).str.strip().str.lower().map(lambda x: 1 if "yes" in x or "employed" in x else 0)
            if not s.empty:
                insights.append(f"Overall employment rate (from employment_data): {s.mean()*100:.0f}% ({int(s.sum())} employed out of {len(s)} records).")

    # survey completion
    if not surveys.empty and "is_completed" in surveys.columns:
        try:
            rate = surveys["is_completed"].astype(float).mean()*100
            insights.append(f"Survey completion: {rate:.0f}% of respondents completed the survey.")
        except Exception:
            pass

    # popular degree
    if not edu.empty:
        deg_col = next((c for c in edu.columns if "degree" in c.lower()), None)
        if deg_col:
            top_deg_counts = edu[deg_col].value_counts()
            if not top_deg_counts.empty:
                insights.append(f"Most common degree: {top_deg_counts.idxmax()} ({top_deg_counts.max():,} graduates).")

    # age summary
    if not gp.empty and "age" in gp.columns:
        ages = gp["age"].dropna()
        if not ages.empty:
            insights.append(f"Alumni age — median: {int(ages.median())}, mean: {ages.mean():.1f}, range: {int(ages.min())}–{int(ages.max())}.")

    # competency note
    if not comps.empty and "competency" in comps.columns:
        top_comp = comps["competency"].value_counts()
        if not top_comp.empty:
            insights.append(f"Top competency reported: {top_comp.idxmax()} ({top_comp.max():,} mentions). Consider aligning curriculum.")

    if comparison_datasets:
        # Employment rate comparison insights
        emp_rates = []
        for dataset_name, dataset in comparison_datasets.items():
            emp_comp = dataset.get("employment_data", pd.DataFrame())
            if not emp_comp.empty:
                is_emp_col = next((c for c in emp_comp.columns if "is_employed" in c.lower() or "employment_status" in c.lower()), None)
                if is_emp_col:
                    s = emp_comp[is_emp_col].astype(str).str.strip().str.lower().map(lambda x: 1 if "yes" in x or "employed" in x else 0)
                    if not s.empty:
                        emp_rate = s.mean() * 100
                        emp_rates.append((dataset_name, emp_rate, len(emp_comp)))
        
        if len(emp_rates) >= 2:
            emp_rates.sort(key=lambda x: x[1], reverse=True)
            best = emp_rates[0]
            worst = emp_rates[-1]
            insights.append(f"📊 Comparison Analysis: {best[0]} has the highest employment rate at {best[1]:.1f}%, while {worst[0]} has the lowest at {worst[1]:.1f}%.")
            
            if best[1] >= worst[1] * 1.5:  # 50% higher
                insights.append(f"⚠️ Significant disparity detected: {best[0]} graduates are significantly more likely to be employed than {worst[0]} graduates.")
        
        # Graduate count comparison
        grad_counts = []
        for dataset_name, dataset in comparison_datasets.items():
            edu_comp = dataset.get("educational_background", pd.DataFrame())
            if not edu_comp.empty:
                grad_counts.append((dataset_name, len(edu_comp)))
        
        if grad_counts:
            grad_counts.sort(key=lambda x: x[1], reverse=True)
            total_grads = sum(count for _, count in grad_counts)
            largest = grad_counts[0]
            insights.append(f"📈 Dataset sizes: {largest[0]} has the most graduates ({largest[1]:,}, {largest[1]/total_grads*100:.1f}% of total).")

    # recent engagement
    act = filtered.get("activity_logs", pd.DataFrame())
    if not act.empty and "created_at" in act.columns:
        act["date"] = pd.to_datetime(act["created_at"], errors="coerce").dt.date
        recent = act[act["date"] >= (datetime.now().date() - timedelta(days=30))]
        insights.append(f"Recent engagement: {len(recent):,} activities in the last 30 days.")

    return insights

# ---------------------------
# Export flattened dataframe
# ---------------------------
def get_filtered_dataframe_for_export(filtered: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    users = filtered.get("users", pd.DataFrame())
    edu = filtered.get("educational_background", pd.DataFrame())
    gp = filtered.get("graduate_profiles", pd.DataFrame())
    emp = filtered.get("employment_data", pd.DataFrame())
    surv = filtered.get("survey_responses", pd.DataFrame())

    if users.empty:
        # fallback: try edu as base
        if not edu.empty:
            base = edu.copy()
            if not gp.empty:
                base = base.merge(gp, on="user_id", how="left", suffixes=("_edu", "_profile"))
            if not emp.empty:
                base = base.merge(emp, on="user_id", how="left")
            if not surv.empty:
                base = base.merge(surv, on="user_id", how="left")
            return base
        return pd.DataFrame()

    base = users.copy().rename(columns={"id": "user_id"}).set_index("user_id")
    def join_table(b, tbl, tag):
        if tbl.empty or "user_id" not in tbl.columns:
            return b
        t2 = tbl.copy().set_index("user_id")
        t2 = t2.add_prefix(f"{tag}_")
        return b.join(t2, how="left")
    base = join_table(base, gp, "profile")
    base = join_table(base, edu, "education")
    base = join_table(base, emp, "employment")
    base = join_table(base, surv, "survey")
    return base.reset_index()

# ---------------------------
# Main application
# ---------------------------
def main():
    st.markdown('<div class="main-header">Alumify Analytics PRO</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Data-driven dashboard with enhanced comparison capabilities</div>', unsafe_allow_html=True)

    dfs = load_all()
    top_filters = top_filter_bar(dfs)
    filtered = apply_filters(dfs, {"year": top_filters["year"], "program": top_filters["program"], "gender": top_filters["gender"]})
    compare_by = top_filters.get("compare_by", "None")
    
    comparison_datasets = create_comparison_datasets(dfs, compare_by) if compare_by != "None" else {}

    # Show KPIs
    show_kpis(filtered, comparison_datasets)

    st.markdown("---")

    # Visual sections with comparison support
    with st.expander("Demographics & Education", expanded=True):
        visualize_demographics(filtered, compare_by, comparison_datasets)
        visualize_education(filtered, compare_by, comparison_datasets)

    with st.expander("Employment & Careers", expanded=True):
        visualize_employment(filtered, compare_by, comparison_datasets)

    with st.expander("Engagement", expanded=False):
        visualize_engagement(filtered)

    with st.expander("Competencies & Text Feedback", expanded=False):
        visualize_competencies_and_texts(filtered)

    # Enhanced Insights with comparison analysis
    st.markdown('<div class="story-section">', unsafe_allow_html=True)
    st.markdown('<h3 class="section-header">💡 Key Insights & Comparisons</h3>', unsafe_allow_html=True)
    insights = generate_insights(filtered, compare_by, comparison_datasets)
    if not insights:
        st.info("No insights available for the selected filters.")
    else:
        for ins in insights:
            if "📊" in ins or "⚠️" in ins or "📈" in ins:
                st.success(ins)  # Highlight comparison insights
            else:
                st.info(ins)
    st.markdown('</div>', unsafe_allow_html=True)

    # Exports
    st.markdown("---")
    st.header("Export Filtered Data")
    export_df = get_filtered_dataframe_for_export(filtered)
    if export_df.empty:
        st.info("No data available to export for the current filters.")
    else:
        st.write(f"Filtered dataset contains {len(export_df):,} rows.")
        c1, c2 = st.columns(2)
        with c1:
            csv = export_df.to_csv(index=False).encode('utf-8')
            st.download_button("Download CSV", data=csv, file_name="alumify_filtered.csv", mime="text/csv")
        with c2:
            towrite = io.BytesIO()
            with pd.ExcelWriter(towrite, engine='xlsxwriter') as writer:
                export_df.to_excel(writer, index=False, sheet_name='Filtered')
            towrite.seek(0)
            st.download_button("Download Excel", data=towrite, file_name="alumify_filtered.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    # Footer
    st.markdown("---")
    st.caption(f"Last refreshed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    st.caption("Enhanced with multi-dataset comparison capabilities - All analyses are based on available fields in your alumify database.")

if __name__ == "__main__":
    main()
