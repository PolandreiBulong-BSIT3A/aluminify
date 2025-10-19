# dashboard_gts_final.py
import streamlit as st
import pandas as pd
import plotly.express as px
import mysql.connector
import time
from threading import Thread, Event
from queue import Queue
import numpy as np
import re

# =============================
# CONFIG
# =============================
REFRESH_INTERVAL = 5
DATABASE_CHECK_INTERVAL = 2
MAX_RETRIES = 3

# =============================
# DB CONNECTION
# =============================
def get_db_connection():
    for attempt in range(MAX_RETRIES):
        try:
            conn = mysql.connector.connect(
                host="127.0.0.1",
                database="alumify",
                user="root",
                password="",
                autocommit=True,
                connect_timeout=5
            )
            if conn.is_connected():
                try:
                    st.session_state.db_connection_error = False
                except Exception:
                    pass
                return conn
        except mysql.connector.Error:
            try:
                st.session_state.db_connection_error = True
            except Exception:
                pass
            if attempt == MAX_RETRIES - 1:
                try:
                    st.error(f"Failed to connect to database after {MAX_RETRIES} attempts")
                except Exception:
                    pass
                return None
            time.sleep(1)
    return None

# =============================
# DB WATCHER
# =============================
class DatabaseWatcher:
    def __init__(self):
        self.conn = None
        self.last_update_times = {}
        self.stop_event = Event()
        self.change_queue = Queue()
        self.watch_thread = None
        self._initialize()

    def _initialize(self):
        self.conn = get_db_connection()
        if self.conn is None:
            return
        self.watch_thread = Thread(target=self._watch_changes, daemon=True)
        self.watch_thread.start()

    def _watch_changes(self):
        tables = [
            'users', 'activity_logs', 'employment_data',
            'educational_background', 'survey_responses',
            'graduate_profiles', 'course_reasons',
            'unemployment_reasons', 'useful_competencies',
            'curriculum_suggestions'
        ]
        while not self.stop_event.is_set():
            try:
                if not self.conn or not getattr(self.conn, "is_connected", lambda: False)():
                    self.conn = get_db_connection()
                    if not self.conn:
                        time.sleep(5)
                        continue
                if self._check_tables(tables):
                    try:
                        self.change_queue.put(True)
                    except Exception:
                        pass
                time.sleep(DATABASE_CHECK_INTERVAL)
            except Exception:
                time.sleep(5)

    def _check_tables(self, tables):
        changes_detected = False
        cursor = None
        try:
            cursor = self.conn.cursor(dictionary=True, buffered=True)
            for table in tables:
                try:
                    cursor.execute(f"SELECT MAX(updated_at) as last_update FROM {table}")
                    result = cursor.fetchone()
                    current_last_update = result['last_update'] if result else None
                    if table not in self.last_update_times:
                        self.last_update_times[table] = current_last_update
                    elif current_last_update != self.last_update_times[table]:
                        self.last_update_times[table] = current_last_update
                        changes_detected = True
                except mysql.connector.Error:
                    # table might not have updated_at; attempt alternative
                    try:
                        cursor.execute(f"SELECT MAX(created_at) as last_update FROM {table}")
                        result = cursor.fetchone()
                        current_last_update = result['last_update'] if result else None
                        if table not in self.last_update_times:
                            self.last_update_times[table] = current_last_update
                        elif current_last_update != self.last_update_times[table]:
                            self.last_update_times[table] = current_last_update
                            changes_detected = True
                    except Exception:
                        continue
            return changes_detected
        except Exception:
            return False
        finally:
            if cursor:
                cursor.close()

    def stop(self):
        self.stop_event.set()
        if self.watch_thread:
            self.watch_thread.join(timeout=1)
        if self.conn and getattr(self.conn, "is_connected", lambda: False)():
            try:
                self.conn.close()
            except Exception:
                pass

# =============================
# RUN QUERY
# =============================
def run_query(query):
    conn, cursor = None, None
    try:
        conn = get_db_connection()
        if conn is None:
            return []
        cursor = conn.cursor(dictionary=True, buffered=True)
        cursor.execute(query)
        if cursor.with_rows:
            results = cursor.fetchall()
            return results if results else []
        else:
            conn.commit()
            return []
    except mysql.connector.Error as e:
        try:
            st.error(f"Database query error: {str(e)}")
        except Exception:
            pass
        return []
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn and getattr(conn, "is_connected", lambda: False)():
            try:
                conn.close()
            except Exception:
                pass

# =============================
# LOAD DATA
# =============================
@st.cache_data(ttl=30)
def load_users_data():
    return pd.DataFrame(run_query("SELECT id as user_id, email, name, role, created_at, updated_at FROM users WHERE role!='admin'"))

@st.cache_data(ttl=30)
def load_profiles_data():
    return pd.DataFrame(run_query("SELECT * FROM graduate_profiles"))

@st.cache_data(ttl=30)
def load_employment_data():
    return pd.DataFrame(run_query("SELECT * FROM employment_data"))

@st.cache_data(ttl=30)
def load_education_data():
    return pd.DataFrame(run_query("SELECT * FROM educational_background"))

@st.cache_data(ttl=30)
def load_survey_data():
    return pd.DataFrame(run_query("SELECT * FROM survey_responses"))

@st.cache_data(ttl=30)
def load_activity_data():
    return pd.DataFrame(run_query("SELECT * FROM activity_logs"))

@st.cache_data(ttl=30)
def load_course_reasons():
    return pd.DataFrame(run_query("SELECT * FROM course_reasons"))

@st.cache_data(ttl=30)
def load_competencies():
    return pd.DataFrame(run_query("SELECT * FROM useful_competencies"))

@st.cache_data(ttl=30)
def load_suggestions():
    return pd.DataFrame(run_query("SELECT * FROM curriculum_suggestions"))

@st.cache_data(ttl=30)
def load_unemployment_reasons():
    return pd.DataFrame(run_query("SELECT * FROM unemployment_reasons"))

# =============================
# UTIL FUNCTIONS
# =============================
def export_download(df, label="data_export"):
    if df is None:
        return
    try:
        if hasattr(df, "empty") and df.empty:
            return
    except Exception:
        return
    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label=f"⬇️ Download {label}.csv",
        data=csv,
        file_name=f"{label}.csv",
        mime="text/csv",
        key=f"download_{label}_{int(time.time())}"
    )

def salary_to_numeric(s):
    if pd.isna(s):
        return np.nan
    s = str(s)
    nums = re.findall(r'\d+(?:,\d{3})*', s)
    nums = [int(n.replace(',', '')) for n in nums]
    if len(nums) == 0:
        return np.nan
    low_s = s.lower()
    # heuristics for ranges like "P5,000.00 to less than P10,000.00"
    if 'below' in low_s or 'less than' in low_s:
        return nums[0] * 0.8
    if 'and above' in low_s or 'above' in low_s or 'and over' in low_s:
        return nums[0] * 1.2
    if len(nums) == 1:
        return float(nums[0])
    # assume first & last are range bounds
    return float((nums[0] + nums[-1]) / 2)

def pair_counts(df, cols):
    if df is None or df.empty:
        return pd.DataFrame(columns=cols + ['count'])
    try:
        gp = df.groupby(cols).size().reset_index(name='count')
        return gp
    except Exception:
        return pd.DataFrame(columns=cols + ['count'])

def build_filter_summary(prog_compare, selected_years, selected_sex):
    parts = []
    if prog_compare:
        parts.append("Programs: " + ", ".join(prog_compare))
    if selected_years:
        parts.append("Years: " + ", ".join(selected_years))
    if selected_sex:
        parts.append("Sex: " + ", ".join(selected_sex))
    return " | ".join(parts) if parts else "No filters applied (showing all data)"

def build_ident_label(df,
                      include_degree=True,
                      include_year=True,
                      include_sex=True,
                      degree_col="degree",
                      year_col="year_graduated",
                      sex_col="sex"):
    """
    Create ident_label column that combines selected fields.
    Skips missing parts. If nothing present, returns 'All'.
    """
    if df is None or df.empty:
        return df
    df = df.copy()

    parts_cols = []
    if include_degree and degree_col in df.columns:
        parts_cols.append(degree_col)
    if include_year and year_col in df.columns:
        parts_cols.append(year_col)
    if include_sex and sex_col in df.columns:
        parts_cols.append(sex_col)

    if not parts_cols:
        df["ident_label"] = "All"
        return df

    def make_label(row):
        pieces = []
        for c in parts_cols:
            val = row.get(c)
            if pd.isna(val):
                continue
            s = str(val).strip()
            if s == "" or s.lower() in ["nan", "none", "null"]:
                continue
            pieces.append(s)
        if pieces:
            return " — ".join(pieces)
        return np.nan

    df["ident_label"] = df.apply(make_label, axis=1)

    # Fallbacks: degree -> year -> sex -> All
    fallback_series = pd.Series(np.nan, index=df.index)
    if degree_col in df.columns:
        fallback_series = fallback_series.fillna(df[degree_col].astype(str).replace({"nan": np.nan}))
    if year_col in df.columns:
        fallback_series = fallback_series.fillna(df[year_col].astype(str).replace({"nan": np.nan}))
    if sex_col in df.columns:
        fallback_series = fallback_series.fillna(df[sex_col].astype(str).replace({"nan": np.nan}))

    df["ident_label"] = df["ident_label"].fillna(fallback_series)
    df["ident_label"] = df["ident_label"].fillna("All")
    return df

add_ident_label = build_ident_label

# =============================
# APP INIT
# =============================
def init_app():
    st.set_page_config(page_title="Alumify GTS Dashboard", page_icon="📊", layout="wide")
    if "db_watcher" not in st.session_state:
        try:
            st.session_state.db_watcher = DatabaseWatcher()
        except Exception:
            pass
    if "db_connection_error" not in st.session_state:
        st.session_state.db_connection_error = False
    if "auto_refresh" not in st.session_state:
        st.session_state.auto_refresh = True

# =============================
# MAIN DASHBOARD
# =============================
def main_dashboard():
    init_app()
    st.title("📊 Alumify — Graduate Tracer Survey Analytics")

    # ----------------------------
    # Load data
    # ----------------------------
    users = load_users_data()
    profiles = load_profiles_data()
    employment = load_employment_data()
    education = load_education_data()
    surveys = load_survey_data()
    activities = load_activity_data()
    course_reasons = load_course_reasons()
    competencies = load_competencies()
    suggestions = load_suggestions()
    unemployment = load_unemployment_reasons()

    # If DB watcher detected changes and auto-refresh enabled, rerun
    try:
        watcher = st.session_state.get("db_watcher", None)
        if watcher and st.session_state.get("auto_refresh", True):
            if not watcher.change_queue.empty():
                try:
                    while not watcher.change_queue.empty():
                        watcher.change_queue.get_nowait()
                except Exception:
                    pass
                st.experimental_rerun()
    except Exception:
        pass

    # basic existence check
    if (users is None or (hasattr(users, "empty") and users.empty)) and (education is None or (hasattr(education, "empty") and education.empty)):
        st.warning("No data available. Please make sure your SQL dump is imported and the database is running.")
        return

    # ----------------------------
    # Sidebar: filters + view mode toggle
    # ----------------------------
    st.sidebar.header("🔎 Filters")

    # Year filter
    year_opts = []
    if education is not None and not education.empty and "year_graduated" in education.columns:
        # cast to str and sort
        year_opts = sorted([str(y) for y in education["year_graduated"].dropna().unique()])
    selected_years = st.sidebar.multiselect("Filter by Graduation Year", year_opts)

    # Program filter (and compare) — allow 1+ programs (user requested compare one program across years)
    prog_opts = []
    if education is not None and not education.empty and "degree" in education.columns:
        prog_opts = sorted([str(d) for d in education["degree"].dropna().unique()])
    prog_compare = st.sidebar.multiselect("Select Programs (for comparison)", prog_opts, help="Select 1+ programs")

    # Sex filter
    sex_opts = []
    if profiles is not None and not profiles.empty and "sex" in profiles.columns:
        sex_opts = sorted([str(s) for s in profiles["sex"].dropna().unique()])
    selected_sex = st.sidebar.multiselect("Filter by Sex", sex_opts)

    # Comparison display mode: Grouped or Separated (global)
    view_mode = st.sidebar.radio("View Mode", options=["Grouped", "Separated"], index=0, help="Grouped = combined chart; Separated = each combination colored & labeled")

    # Auto-refresh toggle
    st.sidebar.markdown("---")
    st.sidebar.checkbox("Auto-refresh on DB change", value=st.session_state.auto_refresh, key="auto_refresh")

    # Admin SQL runner (kept in sidebar)
    with st.sidebar.expander("🛠️ Admin Tools", expanded=False):
        st.write("Run custom SQL (SELECT only recommended). Use with caution.")
        query_input = st.text_area("Enter SQL Query (SELECT...):", "SELECT * FROM employment_data LIMIT 5", height=120)
        if st.button("▶️ Run Query", key="run_query"):
            if query_input.strip():
                try:
                    custom_result = run_query(query_input)
                    if isinstance(custom_result, list) and custom_result:
                        df_custom = pd.DataFrame(custom_result)
                        st.dataframe(df_custom)
                        export_download(df_custom, "custom_query_result")
                    else:
                        st.info("Query executed. No rows returned or non-SELECT executed.")
                except Exception as e:
                    st.error(f"Error running query: {e}")

    # ----------------------------
    # Filtering core: get filtered user ids (intersection)
    # ----------------------------
    def get_filtered_user_ids():
        """
        Return:
          - None -> no filters applied (don't filter)
          - set() -> filters applied but no matches
          - set of user_ids -> intersection of applied filters
        """
        sets = []

        # Education-based filters (years / programs)
        if (selected_years and len(selected_years) > 0) or (prog_compare and len(prog_compare) > 0):
            if education is None or education.empty or "user_id" not in education.columns:
                # user asked to filter by year/program but we don't have education table -> no matches
                return set()
            edu = education.copy()
            if selected_years:
                edu = edu[edu["year_graduated"].astype(str).isin(selected_years)]
            if prog_compare:
                edu = edu[edu["degree"].astype(str).isin(prog_compare)]
            if edu.empty:
                return set()
            sets.append(set(edu["user_id"].unique()))

        # Sex filter (profiles)
        if selected_sex and len(selected_sex) > 0:
            if profiles is None or profiles.empty or "user_id" not in profiles.columns:
                return set()
            prof = profiles.copy()
            prof = prof[prof["sex"].astype(str).isin(selected_sex)]
            if prof.empty:
                return set()
            sets.append(set(prof["user_id"].unique()))

        if not sets:
            return None  # no filters applied

        # intersection
        ids = sets[0]
        for s in sets[1:]:
            ids = ids & s
        return ids

    def filter_dataframe(df, user_id_col="user_id"):
        """Apply the computed filtered user ids to any dataframe (if filters active)."""
        if df is None or df.empty or user_id_col not in df.columns:
            return df
        ids = get_filtered_user_ids()
        if ids is None:
            return df.copy()
        if not ids:
            # return empty df with same columns
            return df.iloc[0:0].copy()
        return df[df[user_id_col].isin(ids)].copy()

    # Apply filters to all data sources
    users_filtered = filter_dataframe(users)
    profiles_filtered = filter_dataframe(profiles)
    employment_filtered = filter_dataframe(employment)
    education_filtered = filter_dataframe(education)
    surveys_filtered = filter_dataframe(surveys)
    activities_filtered = filter_dataframe(activities)
    course_reasons_filtered = filter_dataframe(course_reasons)
    competencies_filtered = filter_dataframe(competencies)
    suggestions_filtered = filter_dataframe(suggestions)
    unemployment_filtered = filter_dataframe(unemployment)

    # Merge core: education + profiles + employment for demographic merged_core
    merged_core = pd.DataFrame() if education_filtered is None or education_filtered.empty else education_filtered.copy()
    if not merged_core.empty and profiles_filtered is not None and not profiles_filtered.empty:
        if "user_id" in merged_core.columns and "user_id" in profiles_filtered.columns:
            merged_core = merged_core.merge(profiles_filtered, on="user_id", how="left", suffixes=("", "_profile"))
    if not merged_core.empty and employment_filtered is not None and not employment_filtered.empty:
        if "user_id" in merged_core.columns and "user_id" in employment_filtered.columns:
            merged_core = merged_core.merge(employment_filtered, on="user_id", how="left", suffixes=("", "_employment"))

    # ensure degree exists in merged_core if available from education_filtered
    if merged_core is not None and not merged_core.empty and "degree" not in merged_core.columns:
        if education_filtered is not None and "degree" in education_filtered.columns:
            try:
                # map by user_id
                lookup = education_filtered.set_index("user_id")["degree"].to_dict()
                merged_core["degree"] = merged_core["user_id"].map(lookup)
            except Exception:
                pass

    # Comparison mode logic: treat as comparison active if user selected programs OR years (user-requested behavior)
    comparison_mode = True if (prog_compare and len(prog_compare) >= 1) or (selected_years and len(selected_years) >= 1) else False

    # Check if overall datasets are empty after filtering
    all_empty = True
    for df in [merged_core, education_filtered, employment_filtered, surveys_filtered, activities_filtered, competencies_filtered, suggestions_filtered]:
        if df is not None and hasattr(df, "empty") and not df.empty:
            all_empty = False
            break

    if all_empty:
        st.warning("No data available for the selected filters. Clear filters or upload more data.")
        return

    # Build flags for which fields to include in ident_label when in Separated mode
    include_degree = bool(prog_compare) or ("degree" in education_filtered.columns if education_filtered is not None else False)
    include_year = bool(selected_years) or ("year_graduated" in education_filtered.columns if education_filtered is not None else False)
    include_sex = bool(selected_sex) or ("sex" in profiles_filtered.columns if profiles_filtered is not None else False)

    # If Separated view, create ident_label columns in relevant dataframes
    if view_mode == "Separated":
        if merged_core is not None and not merged_core.empty:
            merged_core = build_ident_label(merged_core, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if education_filtered is not None and not education_filtered.empty:
            education_filtered = build_ident_label(education_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if employment_filtered is not None and not employment_filtered.empty:
            employment_filtered = build_ident_label(employment_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if surveys_filtered is not None and not surveys_filtered.empty:
            surveys_filtered = build_ident_label(surveys_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if activities_filtered is not None and not activities_filtered.empty:
            activities_filtered = build_ident_label(activities_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if competencies_filtered is not None and not competencies_filtered.empty:
            competencies_filtered = build_ident_label(competencies_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if suggestions_filtered is not None and not suggestions_filtered.empty:
            suggestions_filtered = build_ident_label(suggestions_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)
        if unemployment_filtered is not None and not unemployment_filtered.empty:
            unemployment_filtered = build_ident_label(unemployment_filtered, include_degree=include_degree, include_year=include_year, include_sex=include_sex)

    # Active filter summary
    filter_summary = build_filter_summary(prog_compare, selected_years, selected_sex)
    st.info(filter_summary)

    # If too many unique ident labels in separated mode, warn user
    if view_mode == "Separated":
        sample_df = education_filtered if (education_filtered is not None and not education_filtered.empty) else (merged_core if (merged_core is not None and not merged_core.empty) else None)
        if sample_df is not None and "ident_label" in sample_df.columns:
            unique_labels = sample_df["ident_label"].dropna().unique()
            if len(unique_labels) > 12:
                st.warning(f"You have {len(unique_labels)} unique label combinations. Charts may be cluttered. Consider narrowing filters.")

    # Tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "👥 Demographics", "🎓 Education", "💼 Employment", "📱 Engagement", "🛠️ Competencies & Curriculum"
    ])

    # -----------------------------
    # Tab 1 — Demographics
    # -----------------------------
    with tab1:
        st.subheader("👥 Demographics (GTS)")
        if merged_core is None or merged_core.empty:
            st.info("No demographic data for selected filters.")
        else:
            df = merged_core.copy()

            # Gender distribution
            if "sex" in df.columns and not df["sex"].dropna().empty:
                if view_mode == "Grouped" and comparison_mode and "degree" in df.columns:
                    gp = pair_counts(df, ["degree", "sex"])
                    if not gp.empty:
                        fig = px.bar(gp, x="degree", y="count", color="sex", barmode="group", title="Gender Distribution per Program")
                        st.plotly_chart(fig, use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in df.columns:
                    gp = df.groupby(["ident_label", "sex"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="sex", barmode="group", title="Gender by Ident Label")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    fig = px.pie(df.dropna(subset=["sex"]), names="sex", hole=0.4, title="Gender Distribution")
                    st.plotly_chart(fig, use_container_width=True)

            # Civil status
            if "civil_status" in df.columns and not df["civil_status"].dropna().empty:
                if view_mode == "Grouped" and comparison_mode and "degree" in df.columns:
                    gp = pair_counts(df, ["degree", "civil_status"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="civil_status", barmode="group", title="Civil Status per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in df.columns:
                    gp = df.groupby(["ident_label", "civil_status"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="civil_status", barmode="stack", title="Civil Status (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    counts = df["civil_status"].value_counts().reset_index()
                    counts.columns = ["civil_status", "count"]
                    st.plotly_chart(px.bar(counts, x="civil_status", y="count", title="Civil Status"), use_container_width=True)

            # Age distribution
            if "birthday" in df.columns and not df["birthday"].dropna().empty:
                df["birthday"] = pd.to_datetime(df["birthday"], errors="coerce")
                df["age"] = df["birthday"].apply(lambda x: (pd.Timestamp.now().year - x.year) if pd.notnull(x) else None)
                if view_mode == "Grouped" and comparison_mode and "degree" in df.columns:
                    sub = df.dropna(subset=["age"])
                    if not sub.empty:
                        st.plotly_chart(px.histogram(sub, x="age", color="degree", barmode="group", nbins=12, title="Age Distribution per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in df.columns:
                    sub = df.dropna(subset=["age"])
                    fig = px.histogram(sub, x="age", color="ident_label", barmode="overlay", nbins=12, title="Age Distribution (by ident_label)")
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    sub = df.dropna(subset=["age"])
                    if not sub.empty:
                        st.plotly_chart(px.histogram(sub, x="age", nbins=12, title="Age Distribution"), use_container_width=True)

            # Province
            if "province" in df.columns and not df["province"].dropna().empty:
                gp = df["province"].value_counts().reset_index()
                gp.columns = ["province", "count"]
                st.plotly_chart(px.bar(gp, x="province", y="count", title="Graduates by Province"), use_container_width=True)

            export_download(df, "demographics_data")

    # -----------------------------
    # Tab 2 — Education
    # -----------------------------
    with tab2:
        st.subheader("🎓 Education (GTS)")
        if education_filtered is None or education_filtered.empty:
            st.info("No education records for selected filters.")
        else:
            edu_df = education_filtered.copy()

            # show counts per program
            if "degree" in edu_df.columns:
                deg_counts = edu_df["degree"].value_counts().reset_index()
                deg_counts.columns = ["degree", "count"]
                st.plotly_chart(px.bar(deg_counts, x="degree", y="count", title="Graduates per Program"), use_container_width=True)

            # Graduates per year (with identification)
            if "year_graduated" in edu_df.columns and not edu_df["year_graduated"].dropna().empty:
                edu_df["year_graduated"] = edu_df["year_graduated"].astype(str)

                # Both program compare and years selected
                if prog_compare and selected_years:
                    if view_mode == "Grouped":
                        gp = edu_df.groupby(["year_graduated", "degree"]).size().reset_index(name="count")
                        if not gp.empty:
                            fig = px.line(gp, x="year_graduated", y="count", color="degree", markers=True, title="Graduates per Year (per Program)")
                            st.plotly_chart(fig, use_container_width=True)
                    else:  # Separated: group by ident_label if available
                        if "ident_label" in edu_df.columns:
                            gp = edu_df.groupby(["year_graduated", "ident_label"]).size().reset_index(name="count")
                            fig = px.bar(gp, x="year_graduated", y="count", color="ident_label", barmode="group", title="Graduates per Year (by ident_label)")
                            st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                        else:
                            # show each selected program separately across years
                            for prog in prog_compare:
                                sub = edu_df[edu_df["degree"] == prog]
                                if sub.empty:
                                    continue
                                counts = sub["year_graduated"].value_counts().sort_index().reset_index()
                                counts.columns = ["year_graduated", "count"]
                                st.plotly_chart(px.bar(counts, x="year_graduated", y="count", title=f"Graduates of {prog} per Year"), use_container_width=True)

                elif selected_years and not prog_compare:
                    # Selected years but no specific programs selected -> show degrees in those years
                    if view_mode == "Grouped":
                        gp = edu_df[edu_df["year_graduated"].isin(selected_years)]
                        gp = gp.groupby(["year_graduated", "degree"]).size().reset_index(name="count")
                        if not gp.empty:
                            fig = px.bar(gp, x="degree", y="count", color="year_graduated", barmode="group", title="Graduates by Degree for Selected Years")
                            st.plotly_chart(fig, use_container_width=True)
                    else:
                        if "ident_label" in edu_df.columns:
                            sub = edu_df[edu_df["year_graduated"].isin(selected_years)]
                            gp = sub.groupby(["degree", "ident_label"]).size().reset_index(name="count")
                            fig = px.bar(gp, x="degree", y="count", color="ident_label", barmode="group", title="Graduates (colored by ident_label)")
                            st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                        else:
                            for yr in selected_years:
                                sub = edu_df[edu_df["year_graduated"] == yr]
                                if sub.empty:
                                    continue
                                counts = sub["degree"].value_counts().reset_index()
                                counts.columns = ["degree", "count"]
                                st.plotly_chart(px.bar(counts, x="degree", y="count", title=f"Graduates in {yr}"), use_container_width=True)

                elif prog_compare and not selected_years:
                    # Programs selected, but no years -> show program distribution across all years
                    if view_mode == "Grouped":
                        gp = edu_df.groupby(["year_graduated", "degree"]).size().reset_index(name="count")
                        if not gp.empty:
                            fig = px.line(gp, x="year_graduated", y="count", color="degree", markers=True, title="Graduates per Year (per Program)")
                            st.plotly_chart(fig, use_container_width=True)
                    else:
                        for prog in prog_compare:
                            sub = edu_df[edu_df["degree"] == prog]
                            if sub.empty:
                                continue
                            if "ident_label" in sub.columns:
                                gp = sub.groupby(["year_graduated", "ident_label"]).size().reset_index(name="count")
                                fig = px.bar(gp, x="year_graduated", y="count", color="ident_label", title=f"Graduates of {prog} (by ident_label)")
                                st.plotly_chart(fig, use_container_width=True)
                            else:
                                counts = sub["year_graduated"].value_counts().sort_index().reset_index()
                                counts.columns = ["year_graduated", "count"]
                                st.plotly_chart(px.bar(counts, x="year_graduated", y="count", title=f"Graduates of {prog} per Year"), use_container_width=True)
                else:
                    gp = edu_df["year_graduated"].value_counts().sort_index().reset_index()
                    gp.columns = ["year_graduated", "count"]
                    st.plotly_chart(px.bar(gp, x="year_graduated", y="count", title="Graduates per Year"), use_container_width=True)

            # Reasons for taking the course
            if course_reasons_filtered is not None and not course_reasons_filtered.empty and "reason_type" in course_reasons_filtered.columns:
                cr = course_reasons_filtered.copy()
                # merge only safe columns
                if "user_id" in cr.columns and edu_df is not None and "user_id" in edu_df.columns:
                    merge_cols = ["user_id"]
                    if "degree" in edu_df.columns:
                        merge_cols.append("degree")
                    if "ident_label" in edu_df.columns:
                        merge_cols.append("ident_label")
                    try:
                        left = edu_df.loc[:, merge_cols].drop_duplicates()
                        cr = cr.merge(left, on="user_id", how="left")
                    except Exception:
                        # fallback minimal merge
                        cr = cr.merge(edu_df[["user_id"]].drop_duplicates(), on="user_id", how="left")
                if view_mode == "Grouped" and comparison_mode and "degree" in cr.columns:
                    gp = pair_counts(cr, ["degree", "reason_type"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="reason_type", barmode="group", title="Reasons for Taking Course per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in cr.columns:
                    gp = cr.groupby(["ident_label", "reason_type"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="reason_type", barmode="stack", title="Reasons for Taking Course (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    counts = cr["reason_type"].value_counts().reset_index()
                    counts.columns = ["reason_type", "count"]
                    st.plotly_chart(px.bar(counts, x="reason_type", y="count", title="Reasons for Taking Course"), use_container_width=True)

            export_download(edu_df, "education_data")

    # -----------------------------
    # Tab 3 — Employment
    # -----------------------------
    with tab3:
        st.subheader("💼 Employment (GTS)")
        if (employment_filtered is None or employment_filtered.empty) and (merged_core is None or merged_core.empty):
            st.info("No employment data for selected filters.")
        else:
            emp = pd.DataFrame() if (employment_filtered is None or employment_filtered.empty) else employment_filtered.copy()

            # Ensure degree/year exists in emp by merging from edu if needed (safe selection)
            if not emp.empty and "degree" not in emp.columns and education_filtered is not None and not education_filtered.empty and "user_id" in education_filtered.columns:
                merge_cols = ["user_id"]
                if "degree" in education_filtered.columns:
                    merge_cols.append("degree")
                if "year_graduated" in education_filtered.columns:
                    merge_cols.append("year_graduated")
                if "ident_label" in education_filtered.columns:
                    merge_cols.append("ident_label")
                try:
                    emp = emp.merge(education_filtered.loc[:, merge_cols].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    try:
                        emp = emp.merge(education_filtered[["user_id", "degree"]].drop_duplicates(), on="user_id", how="left")
                    except Exception:
                        pass

            # If Separated and ident_label not present, build
            if view_mode == "Separated" and "ident_label" not in emp.columns:
                emp = build_ident_label(emp, include_degree=include_degree, include_year=include_year, include_sex=include_sex)

            # Employment status
            if "is_employed" in emp.columns and not emp["is_employed"].dropna().empty:
                if view_mode == "Grouped" and comparison_mode and "degree" in emp.columns:
                    gp = pair_counts(emp, ["degree", "is_employed"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="is_employed", barmode="group", title="Employment Status per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in emp.columns:
                    gp = emp.groupby(["ident_label", "is_employed"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="is_employed", barmode="group", title="Employment Status (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    st.plotly_chart(px.pie(emp.dropna(subset=["is_employed"]), names="is_employed", hole=0.4, title="Employment Status"), use_container_width=True)

            # Employment type
            if "employment_status" in emp.columns and not emp["employment_status"].dropna().empty:
                if view_mode == "Grouped" and comparison_mode and "degree" in emp.columns:
                    gp = pair_counts(emp, ["degree", "employment_status"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="employment_status", barmode="group", title="Employment Type per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in emp.columns:
                    gp = emp.groupby(["ident_label", "employment_status"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="employment_status", barmode="stack", title="Employment Type (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    counts = emp["employment_status"].value_counts().reset_index()
                    counts.columns = ["employment_status", "count"]
                    st.plotly_chart(px.bar(counts, x="employment_status", y="count", title="Employment Type"), use_container_width=True)

            # Place of work: ensure alignment
            if "place_of_work" in emp.columns and not emp["place_of_work"].dropna().empty:
                if view_mode == "Grouped" and comparison_mode and "degree" in emp.columns:
                    gp = pair_counts(emp, ["degree", "place_of_work"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="place_of_work", barmode="group", title="Place of Work (Local vs Abroad) per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in emp.columns:
                    gp = emp.groupby(["ident_label", "place_of_work"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="place_of_work", barmode="stack", title="Place of Work (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    counts = emp["place_of_work"].value_counts().reset_index()
                    counts.columns = ["place_of_work", "count"]
                    st.plotly_chart(px.bar(counts, x="place_of_work", y="count", title="Place of Work"), use_container_width=True)

            # Industry distribution
            if "business_line" in emp.columns and not emp["business_line"].dropna().empty:
                emp_lines = emp.dropna(subset=["business_line"]).copy()
                if view_mode == "Grouped" and comparison_mode and "degree" in emp_lines.columns:
                    emp_pair = emp_lines.groupby(["degree", "business_line"]).size().reset_index(name="count")
                    if not emp_pair.empty:
                        st.plotly_chart(px.treemap(emp_pair, path=["degree", "business_line"], values="count", title="Industry Distribution per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in emp_lines.columns:
                    gp = emp_lines.groupby(["ident_label", "business_line"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="business_line", barmode="stack", title="Industry Distribution (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    emp_pair = emp_lines["business_line"].value_counts().reset_index()
                    emp_pair.columns = ["business_line", "count"]
                    st.plotly_chart(px.bar(emp_pair, x="business_line", y="count", title="Industry Distribution"), use_container_width=True)

            # Salary distribution
            if "initial_gross_monthly_earning" in emp.columns and not emp["initial_gross_monthly_earning"].dropna().empty:
                emp["salary_numeric"] = emp["initial_gross_monthly_earning"].apply(salary_to_numeric)
                if view_mode == "Grouped" and comparison_mode and "degree" in emp.columns and emp["salary_numeric"].notna().any():
                    st.plotly_chart(px.box(emp.dropna(subset=["salary_numeric"]), x="degree", y="salary_numeric", title="Estimated Salary Distribution per Program (median of range)"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in emp.columns and emp["salary_numeric"].notna().any():
                    fig = px.box(emp.dropna(subset=["salary_numeric"]), x="ident_label", y="salary_numeric", title="Estimated Salary Distribution (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                elif emp["salary_numeric"].notna().any():
                    st.plotly_chart(px.box(emp.dropna(subset=["salary_numeric"]), y="salary_numeric", title="Estimated Salary Distribution (median of range)"), use_container_width=True)

                counts = emp["initial_gross_monthly_earning"].value_counts().reset_index()
                counts.columns = ["salary_range", "count"]
                st.plotly_chart(px.bar(counts, x="salary_range", y="count", title="Salary Ranges"), use_container_width=True)

            # Curriculum relevance vs Employment Type (heatmap)
            if "curriculum_relevant" in emp.columns and "employment_status" in emp.columns:
                heat = emp.dropna(subset=["curriculum_relevant", "employment_status"])
                if not heat.empty:
                    heatmap = pd.crosstab(heat["curriculum_relevant"], heat["employment_status"])
                    try:
                        st.plotly_chart(px.imshow(heatmap.values,
                                                  x=heatmap.columns.tolist(),
                                                  y=heatmap.index.tolist(),
                                                  text_auto=True,
                                                  title="Curriculum Relevance vs Employment Type"), use_container_width=True)
                    except Exception:
                        st.dataframe(heatmap)

            # Job level distributions
            for col in ["job_level_first", "job_level_current"]:
                if col in emp.columns and not emp[col].dropna().empty:
                    if view_mode == "Separated" and "ident_label" in emp.columns:
                        gp = emp.groupby(["ident_label", col]).size().reset_index(name="count")
                        fig = px.bar(gp, x="ident_label", y="count", color=col, barmode="stack", title=f"{col.replace('_',' ').title()} Distribution (by ident_label)")
                        st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                    else:
                        counts = emp[col].value_counts().reset_index()
                        counts.columns = [col, "count"]
                        st.plotly_chart(px.bar(counts, x=col, y="count", title=f"{col.replace('_',' ').title()} Distribution"), use_container_width=True)

            # Unemployment reasons
            if unemployment_filtered is not None and not unemployment_filtered.empty and "reason" in unemployment_filtered.columns:
                un = unemployment_filtered.copy()
                if "degree" not in un.columns and education_filtered is not None and "user_id" in education_filtered.columns and "degree" in education_filtered.columns:
                    try:
                        un = un.merge(education_filtered[["user_id", "degree"]].drop_duplicates(), on="user_id", how="left")
                    except Exception:
                        pass
                # also attach ident_label if available
                if "ident_label" in education_filtered.columns and "user_id" in un.columns:
                    try:
                        un = un.merge(education_filtered[["user_id", "ident_label"]].drop_duplicates(), on="user_id", how="left")
                    except Exception:
                        pass

                if view_mode == "Grouped" and comparison_mode and "degree" in un.columns:
                    gp = pair_counts(un, ["degree", "reason"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="reason", barmode="group", title="Unemployment Reasons per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in un.columns:
                    gp = un.groupby(["ident_label", "reason"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="reason", barmode="stack", title="Unemployment Reasons (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    counts = un["reason"].value_counts().reset_index()
                    counts.columns = ["reason", "count"]
                    st.plotly_chart(px.bar(counts, x="reason", y="count", title="Unemployment Reasons"), use_container_width=True)

            export_download(emp, "employment_data")

    # -----------------------------
    # Tab 4 — Engagement
    # -----------------------------
    with tab4:
        st.subheader("📱 Engagement (GTS)")
        # Surveys
        if surveys_filtered is not None and not surveys_filtered.empty:
            s = surveys_filtered.copy()
            if "degree" not in s.columns and education_filtered is not None and not education_filtered.empty and "user_id" in education_filtered.columns and "degree" in education_filtered.columns:
                try:
                    s = s.merge(education_filtered[["user_id", "degree"]].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass
            # attach ident_label if available
            if "ident_label" in education_filtered.columns and "user_id" in s.columns:
                try:
                    s = s.merge(education_filtered[["user_id", "ident_label"]].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass

            if "is_completed" in s.columns:
                if view_mode == "Grouped" and comparison_mode and "degree" in s.columns:
                    gp = s.groupby("degree").agg(total=("is_completed", "count"), completed=("is_completed", "sum")).reset_index()
                    gp["pct_completed"] = (gp["completed"] / gp["total"]) * 100
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="pct_completed", text=gp["pct_completed"].round(1), title="Survey Completion Rate per Program"), use_container_width=True)
                elif view_mode == "Separated" and "ident_label" in s.columns:
                    gp = s.groupby(["ident_label"]).agg(total=("is_completed", "count"), completed=("is_completed", "sum")).reset_index()
                    gp["pct_completed"] = (gp["completed"] / gp["total"]) * 100
                    fig = px.bar(gp, x="ident_label", y="pct_completed", text=gp["pct_completed"].round(1), title="Survey Completion (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                else:
                    pct = s["is_completed"].mean() * 100
                    st.metric("Overall Survey Completion Rate", f"{pct:.1f}%")

        # Activities
        if activities_filtered is not None and not activities_filtered.empty:
            a = activities_filtered.copy()
            if "created_at" in a.columns:
                a["created_at"] = pd.to_datetime(a["created_at"], errors="coerce")

            # merge degree/ident_label safely if missing
            if "degree" not in a.columns and education_filtered is not None and not education_filtered.empty and "user_id" in education_filtered.columns and "degree" in education_filtered.columns:
                merge_cols = ["user_id"]
                if "degree" in education_filtered.columns:
                    merge_cols.append("degree")
                if "ident_label" in education_filtered.columns:
                    merge_cols.append("ident_label")
                try:
                    a = a.merge(education_filtered.loc[:, merge_cols].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass

            if view_mode == "Grouped" and comparison_mode and "degree" in a.columns:
                if "activity_type" in a.columns and not a["activity_type"].dropna().empty:
                    gp = pair_counts(a, ["degree", "activity_type"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="activity_type", barmode="group", title="Activity Types per Program"), use_container_width=True)
                if "created_at" in a.columns:
                    a["date"] = a["created_at"].dt.date
                    gp2 = a.groupby(["degree", "date"]).size().reset_index(name="count")
                    if not gp2.empty:
                        st.plotly_chart(px.line(gp2, x="date", y="count", color="degree", title="Activity Timeline per Program"), use_container_width=True)
            elif view_mode == "Separated" and "ident_label" in a.columns:
                if "activity_type" in a.columns and not a["activity_type"].dropna().empty:
                    gp = a.groupby(["ident_label", "activity_type"]).size().reset_index(name="count")
                    fig = px.bar(gp, x="ident_label", y="count", color="activity_type", barmode="stack", title="Activity Types (by ident_label)")
                    st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
                if "created_at" in a.columns:
                    a["date"] = a["created_at"].dt.date
                    gp2 = a.groupby(["ident_label", "date"]).size().reset_index(name="count")
                    if not gp2.empty:
                        st.plotly_chart(px.line(gp2, x="date", y="count", color="ident_label", title="Activity Timeline (by ident_label)"), use_container_width=True)
            else:
                if "activity_type" in a.columns and not a["activity_type"].dropna().empty:
                    counts = a["activity_type"].value_counts().reset_index()
                    counts.columns = ["activity_type", "count"]
                    st.plotly_chart(px.bar(counts, x="activity_type", y="count", title="Activity Types"), use_container_width=True)
                if "created_at" in a.columns:
                    a["date"] = a["created_at"].dt.date
                    gp2 = a.groupby("date").size().reset_index(name="count")
                    if not gp2.empty:
                        st.plotly_chart(px.line(gp2, x="date", y="count", title="System Activity Over Time"), use_container_width=True)

        export_download(activities_filtered, "activities_data")

    # -----------------------------
    # Tab 5 — Competencies & Curriculum
    # -----------------------------
    with tab5:
        st.subheader("🛠️ Competencies & Curriculum Feedback")
        if competencies_filtered is None or competencies_filtered.empty:
            st.info("No competencies data for selected filters.")
        else:
            comp = competencies_filtered.copy()
            # safe merge degree/ident_label
            if "degree" not in comp.columns and education_filtered is not None and not education_filtered.empty and "user_id" in education_filtered.columns and "degree" in education_filtered.columns:
                try:
                    comp = comp.merge(education_filtered[["user_id", "degree"]].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass
            if "ident_label" in education_filtered.columns and "user_id" in comp.columns:
                try:
                    comp = comp.merge(education_filtered[["user_id", "ident_label"]].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass

            if view_mode == "Grouped" and comparison_mode and "degree" in comp.columns and "competency" in comp.columns:
                gp = pair_counts(comp, ["degree", "competency"])
                if not gp.empty:
                    st.plotly_chart(px.bar(gp, x="degree", y="count", color="competency", barmode="group", title="Useful Competencies per Program"), use_container_width=True)
            elif view_mode == "Separated" and "ident_label" in comp.columns and "competency" in comp.columns:
                gp = comp.groupby(["ident_label", "competency"]).size().reset_index(name="count")
                fig = px.bar(gp, x="ident_label", y="count", color="competency", barmode="stack", title="Useful Competencies (by ident_label)")
                st.plotly_chart(fig.update_xaxes(tickangle=45), use_container_width=True)
            elif "competency" in comp.columns:
                counts = comp["competency"].value_counts().reset_index()
                counts.columns = ["competency", "count"]
                st.plotly_chart(px.bar(counts, x="competency", y="count", title="Useful Competencies"), use_container_width=True)

        # Suggestions
        if suggestions_filtered is None or suggestions_filtered.empty:
            st.info("No curriculum suggestions for selected filters.")
        else:
            s = suggestions_filtered.copy()
            if "degree" not in s.columns and education_filtered is not None and not education_filtered.empty and "user_id" in education_filtered.columns and "degree" in education_filtered.columns:
                try:
                    s = s.merge(education_filtered[["user_id", "degree"]].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass
            if "ident_label" in education_filtered.columns and "user_id" in s.columns:
                try:
                    s = s.merge(education_filtered[["user_id", "ident_label"]].drop_duplicates(), on="user_id", how="left")
                except Exception:
                    pass

            if view_mode == "Grouped" and comparison_mode and "degree" in s.columns and "suggestion" in s.columns:
                st.write("**Curriculum Suggestions (grouped)**")
                st.dataframe(s[["degree", "user_id", "suggestion"]].sort_values("degree"))
            elif view_mode == "Separated" and "ident_label" in s.columns and "suggestion" in s.columns:
                for lab in sorted(s["ident_label"].dropna().unique()):
                    st.write(f"**Suggestions — {lab}**")
                    sub = s[s["ident_label"] == lab][["user_id", "suggestion"]]
                    if sub.empty:
                        st.write("No suggestions.")
                    else:
                        st.dataframe(sub)
            elif "suggestion" in s.columns:
                st.write("**Curriculum Suggestions**")
                st.dataframe(s[["user_id", "suggestion"]])

        export_download(competencies_filtered, "competencies_data")

# =============================
# RUN APP
# =============================
def run_app():
    main_dashboard()
    if st.sidebar.button("🔄 Manual Refresh"):
        # clear cached queries so new data is fetched
        try:
            # clear cached run_query results by time-shortening the cache decorator TTLs is best, but we can also call st.experimental_rerun()
            st.experimental_rerun()
        except Exception:
            pass

if __name__ == "__main__":
    run_app()
