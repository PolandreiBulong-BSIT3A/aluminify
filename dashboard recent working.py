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
                    self.change_queue.put(True)
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
        results = cursor.fetchall()
        return results if results else []
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
def load_users_data():
    return pd.DataFrame(run_query("SELECT id as user_id, email, name, role, created_at, updated_at FROM users WHERE role!='admin'"))

def load_profiles_data():
    return pd.DataFrame(run_query("SELECT * FROM graduate_profiles"))

def load_employment_data():
    return pd.DataFrame(run_query("SELECT * FROM employment_data"))

def load_education_data():
    return pd.DataFrame(run_query("SELECT * FROM educational_background"))

def load_survey_data():
    return pd.DataFrame(run_query("SELECT * FROM survey_responses"))

def load_activity_data():
    return pd.DataFrame(run_query("SELECT * FROM activity_logs"))

def load_course_reasons():
    return pd.DataFrame(run_query("SELECT * FROM course_reasons"))

def load_competencies():
    return pd.DataFrame(run_query("SELECT * FROM useful_competencies"))

def load_suggestions():
    return pd.DataFrame(run_query("SELECT * FROM curriculum_suggestions"))

def load_unemployment_reasons():
    return pd.DataFrame(run_query("SELECT * FROM unemployment_reasons"))

# =============================
# UTILS
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
        key=f"download_{label}"
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
    if 'below' in low_s:
        return nums[0] * 0.8
    if 'and above' in low_s or 'above' in low_s:
        return nums[0] * 1.2
    if len(nums) == 1:
        return float(nums[0])
    return float((nums[0] + nums[-1]) / 2)

def pair_counts(df, cols):
    if df is None or df.empty:
        return pd.DataFrame(columns=cols + ['count'])
    try:
        gp = df.groupby(cols).size().reset_index(name='count')
        return gp
    except Exception:
        return pd.DataFrame(columns=cols + ['count'])

# =============================
# DASHBOARD
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

def main_dashboard():
    init_app()
    st.title("📊 Alumify — Graduate Tracer Survey Analytics")

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

    if (users is None or (hasattr(users, "empty") and users.empty)) and (education is None or (hasattr(education, "empty") and education.empty)):
        st.warning("No data available. Please make sure your SQL dump is imported and the database is running.")
        return

    # -------------------------
    # Sidebar filters
    # -------------------------
    st.sidebar.header("🔎 Filters")

    year_opts = []
    if education is not None and not education.empty and "year_graduated" in education.columns:
        year_opts = sorted([str(y) for y in education["year_graduated"].dropna().unique()])
    selected_years = st.sidebar.multiselect("Filter by Graduation Year", year_opts)

    prog_opts = []
    if education is not None and not education.empty and "degree" in education.columns:
        prog_opts = sorted([str(d) for d in education["degree"].dropna().unique()])
    prog_compare = st.sidebar.multiselect("Select Programs (for comparison)", prog_opts, help="Select 2 or 3 programs to see grouped comparison")

    # NEW: Sex filter
    sex_opts = []
    if profiles is not None and not profiles.empty and "sex" in profiles.columns:
        sex_opts = sorted([str(s) for s in profiles["sex"].dropna().unique()])
    selected_sex = st.sidebar.multiselect("Filter by Sex", sex_opts)

    # Apply filters
    if selected_years and "year_graduated" in education.columns:
        education = education[education["year_graduated"].astype(str).isin(selected_years)].copy()

    if prog_compare and "degree" in education.columns:
        education = education[education["degree"].astype(str).isin(prog_compare)].copy()

    if selected_sex and "sex" in profiles.columns:
        profiles = profiles[profiles["sex"].astype(str).isin(selected_sex)].copy()

    # Sync with user_id filtering
    valid_users = set()
    if education is not None and not education.empty and "user_id" in education.columns:
        valid_users.update(education["user_id"].unique())
    if profiles is not None and not profiles.empty and "user_id" in profiles.columns:
        valid_users.update(profiles["user_id"].unique())

    valid_users = list(valid_users)
    if valid_users:
        def filter_by_users(df):
            return df[df["user_id"].isin(valid_users)].copy() if df is not None and not df.empty and "user_id" in df.columns else df
        employment = filter_by_users(employment)
        surveys = filter_by_users(surveys)
        activities = filter_by_users(activities)
        course_reasons = filter_by_users(course_reasons)
        competencies = filter_by_users(competencies)
        suggestions = filter_by_users(suggestions)
        unemployment = filter_by_users(unemployment)

    # merged core
    merged_core = pd.DataFrame() if (education is None or education.empty) else education.copy()
    if not merged_core.empty and profiles is not None and not profiles.empty:
        if "user_id" in merged_core.columns and "user_id" in profiles.columns:
            merged_core = merged_core.merge(profiles, on="user_id", how="left", suffixes=("", "_profile"))
    if not merged_core.empty and employment is not None and not employment.empty:
        if "user_id" in merged_core.columns and "user_id" in employment.columns:
            merged_core = merged_core.merge(employment, on="user_id", how="left", suffixes=("", "_employment"))

    if merged_core is not None and not merged_core.empty and "degree" not in merged_core.columns and "degree" in education.columns:
        merged_core["degree"] = education["degree"]

    comparison_mode = True if prog_compare and len(prog_compare) >= 2 else False

    all_empty = True
    for df in [merged_core, education, employment, surveys, activities, competencies, suggestions]:
        if df is not None and hasattr(df, "empty") and not df.empty:
            all_empty = False
            break

    if all_empty:
        st.warning("No data available for the selected filters. Clear filters or upload more data.")
        return

    # We will show the same tabs; content inside each tab checks its own data availability
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "👥 Demographics", "🎓 Education", "💼 Employment", "📱 Engagement", "🛠️ Competencies & Curriculum"
    ])

    # -----------------------------
    # Tab 1 — Demographics
    # -----------------------------
    with tab1:
        st.subheader("👥 Demographics (GTS)")
        if merged_core is None or merged_core.empty:
            st.info("Walang demographic data para sa selected filters.")
        else:
            df = merged_core.copy()
            # Gender distribution per degree
            if "sex" in df.columns and not df["sex"].dropna().empty:
                if comparison_mode:
                    gp = pair_counts(df, ["degree", "sex"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="sex", barmode="group",
                                               title="Gender Distribution per Program"), use_container_width=True)
                else:
                    st.plotly_chart(px.pie(df.dropna(subset=["sex"]), names="sex", hole=0.4, title="Gender Distribution"), use_container_width=True)

            # Civil status
            if "civil_status" in df.columns and not df["civil_status"].dropna().empty:
                if comparison_mode:
                    gp = pair_counts(df, ["degree", "civil_status"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="civil_status", barmode="group",
                                               title="Civil Status per Program"), use_container_width=True)
                else:
                    counts = df["civil_status"].value_counts().reset_index()
                    counts.columns = ["civil_status", "count"]
                    st.plotly_chart(px.bar(counts, x="civil_status", y="count", title="Civil Status"), use_container_width=True)

            # Age distribution
            if "birthday" in df.columns and not df["birthday"].dropna().empty:
                df["birthday"] = pd.to_datetime(df["birthday"], errors="coerce")
                df["age"] = df["birthday"].apply(lambda x: pd.Timestamp.now().year - x.year if pd.notnull(x) else None)
                if comparison_mode:
                    gp = df.dropna(subset=["age"])
                    if not gp.empty:
                        st.plotly_chart(px.histogram(gp, x="age", color="degree", barmode="group", title="Age Distribution per Program", nbins=10), use_container_width=True)
                else:
                    gp = df.dropna(subset=["age"])
                    if not gp.empty:
                        st.plotly_chart(px.histogram(gp, x="age", nbins=10, title="Age Distribution"), use_container_width=True)

          

            export_download(df, "demographics_data")

    # -----------------------------
    # Tab 2 — Education
    # -----------------------------
    with tab2:
        st.subheader("🎓 Education (GTS)")
        if education is None or education.empty:
            st.info("Walang education records sa mga napiling filters.")
        else:
            edu = education.copy()
            if "degree" in edu.columns:
                deg_counts = edu["degree"].value_counts().reset_index()
                deg_counts.columns = ["degree", "count"]
                st.plotly_chart(px.bar(deg_counts, x="degree", y="count", title="Graduates per Program"), use_container_width=True)

            if "year_graduated" in edu.columns and not edu["year_graduated"].dropna().empty:
                edu_year = edu.copy()
                edu_year["year_graduated"] = edu_year["year_graduated"].astype(str)
                if comparison_mode and "degree" in edu_year.columns:
                    gp = edu_year.groupby(["degree", "year_graduated"]).size().reset_index(name="count")
                    if not gp.empty:
                        st.plotly_chart(px.line(gp, x="year_graduated", y="count", color="degree", markers=True, title="Graduates per Year (per Program)"), use_container_width=True)
                else:
                    gp = edu_year["year_graduated"].value_counts().sort_index().reset_index()
                    gp.columns = ["year_graduated", "count"]
                    st.plotly_chart(px.bar(gp, x="year_graduated", y="count", title="Graduates per Year"), use_container_width=True)

            # Reasons for taking the course
            if course_reasons is not None and not course_reasons.empty and "reason_type" in course_reasons.columns:
                cr = course_reasons.copy()
                if "user_id" in cr.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                    cr = cr.merge(education[["user_id", "degree"]], on="user_id", how="left")
                if comparison_mode and "degree" in cr.columns:
                    gp = pair_counts(cr, ["degree", "reason_type"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="reason_type", barmode="group", title="Reasons for Taking Course per Program"), use_container_width=True)
                else:
                    counts = cr["reason_type"].value_counts().reset_index()
                    counts.columns = ["reason_type", "count"]
                    st.plotly_chart(px.bar(counts, x="reason_type", y="count", title="Reasons for Taking Course"), use_container_width=True)

            export_download(edu, "education_data")

    # -----------------------------
    # Tab 3 — Employment
    # -----------------------------
    with tab3:
        st.subheader("💼 Employment (GTS)")
        if (employment is None or employment.empty) and (merged_core is None or merged_core.empty):
            st.info("Walang employment data para sa napiling filters.")
        else:
            emp = pd.DataFrame() if (employment is None or employment.empty) else employment.copy()

            # Ensure degree present for grouping
            if not emp.empty and "degree" not in emp.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                emp = emp.merge(education[["user_id", "degree"]], on="user_id", how="left")

            # Employment status
            if "is_employed" in emp.columns and not emp["is_employed"].dropna().empty:
                if comparison_mode and "degree" in emp.columns:
                    gp = pair_counts(emp, ["degree", "is_employed"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="is_employed", barmode="group", title="Employment Status per Program"), use_container_width=True)
                else:
                    st.plotly_chart(px.pie(emp.dropna(subset=["is_employed"]), names="is_employed", hole=0.4, title="Employment Status"), use_container_width=True)

            # Employment type
            if "employment_status" in emp.columns and not emp["employment_status"].dropna().empty:
                if comparison_mode and "degree" in emp.columns:
                    gp = pair_counts(emp, ["degree", "employment_status"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="employment_status", barmode="group", title="Employment Type per Program"), use_container_width=True)
                else:
                    counts = emp["employment_status"].value_counts().reset_index()
                    counts.columns = ["employment_status", "count"]
                    st.plotly_chart(px.bar(counts, x="employment_status", y="count", title="Employment Type"), use_container_width=True)

            # Place of work
            if "place_of_work" in emp.columns and not emp["place_of_work"].dropna().empty:
                if comparison_mode and "degree" in emp.columns:
                    gp = pair_counts(emp, ["degree", "place_of_work"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="place_of_work", barmode="group", title="Place of Work (Local vs Abroad) per Program"), use_container_width=True)
                else:
                    st.plotly_chart(px.pie(emp.dropna(subset=["place_of_work"]), names="place_of_work", hole=0.4, title="Place of Work"), use_container_width=True)

            # Industry distribution (treemap)
            if "business_line" in emp.columns and not emp["business_line"].dropna().empty:
                emp_lines = emp.dropna(subset=["business_line"]).copy()
                if "degree" in emp_lines.columns:
                    emp_pair = emp_lines.groupby(["degree", "business_line"]).size().reset_index(name="count")
                    if not emp_pair.empty:
                        st.plotly_chart(px.treemap(emp_pair, path=["degree", "business_line"], values="count", title="Industry Distribution per Program"), use_container_width=True)
                else:
                    emp_pair = emp_lines["business_line"].value_counts().reset_index()
                    emp_pair.columns = ["business_line", "count"]
                    st.plotly_chart(px.bar(emp_pair, x="business_line", y="count", title="Industry Distribution"), use_container_width=True)

            # Salary distribution
            if "initial_gross_monthly_earning" in emp.columns and not emp["initial_gross_monthly_earning"].dropna().empty:
                emp["salary_numeric"] = emp["initial_gross_monthly_earning"].apply(salary_to_numeric)
                if comparison_mode and "degree" in emp.columns and emp["salary_numeric"].notna().any():
                    st.plotly_chart(px.box(emp.dropna(subset=["salary_numeric"]), x="degree", y="salary_numeric", title="Estimated Salary Distribution per Program (median of range)"), use_container_width=True)
                elif emp["salary_numeric"].notna().any():
                    st.plotly_chart(px.box(emp.dropna(subset=["salary_numeric"]), y="salary_numeric", title="Estimated Salary Distribution (median of range)"), use_container_width=True)

                # categorical salary ranges
                counts = emp["initial_gross_monthly_earning"].value_counts().reset_index()
                counts.columns = ["salary_range", "count"]
                st.plotly_chart(px.bar(counts, x="salary_range", y="count", title="Salary Ranges"), use_container_width=True)

            # Unemployment reasons
            if unemployment is not None and not unemployment.empty and "reason" in unemployment.columns:
                un = unemployment.copy()
                if "degree" not in un.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                    un = un.merge(education[["user_id", "degree"]], on="user_id", how="left")
                if comparison_mode and "degree" in un.columns:
                    gp = pair_counts(un, ["degree", "reason"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="reason", barmode="group", title="Unemployment Reasons per Program"), use_container_width=True)
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
        if surveys is not None and not surveys.empty:
            s = surveys.copy()
            if "degree" not in s.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                s = s.merge(education[["user_id", "degree"]], on="user_id", how="left")
            if comparison_mode and "degree" in s.columns:
                if "is_completed" in s.columns:
                    gp = s.groupby("degree").agg(total=("is_completed", "count"), completed=("is_completed", "sum")).reset_index()
                    gp["pct_completed"] = (gp["completed"] / gp["total"]) * 100
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="pct_completed", text=gp["pct_completed"].round(1), title="Survey Completion Rate per Program"), use_container_width=True)
            else:
                if "is_completed" in s.columns and not s["is_completed"].dropna().empty:
                    pct = s["is_completed"].mean() * 100
                    st.metric("Overall Survey Completion Rate", f"{pct:.1f}%")

        # Activities
        if activities is not None and not activities.empty:
            a = activities.copy()
            if "created_at" in a.columns:
                a["created_at"] = pd.to_datetime(a["created_at"], errors="coerce")
            if "degree" not in a.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                a = a.merge(education[["user_id", "degree"]], on="user_id", how="left")
            if comparison_mode and "degree" in a.columns:
                if "activity_type" in a.columns and not a["activity_type"].dropna().empty:
                    gp = pair_counts(a, ["degree", "activity_type"])
                    if not gp.empty:
                        st.plotly_chart(px.bar(gp, x="degree", y="count", color="activity_type", barmode="group", title="Activity Types per Program"), use_container_width=True)
                # timeline per program
                if "created_at" in a.columns:
                    a["date"] = a["created_at"].dt.date
                    gp2 = a.groupby(["degree", "date"]).size().reset_index(name="count")
                    if not gp2.empty:
                        st.plotly_chart(px.line(gp2, x="date", y="count", color="degree", title="Activity Timeline per Program"), use_container_width=True)
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

        export_download(activities, "activities_data")

    # -----------------------------
    # Tab 5 — Competencies & Curriculum
    # -----------------------------
    with tab5:
        st.subheader("🛠️ Competencies & Curriculum Feedback")
        if competencies is None or competencies.empty:
            st.info("Walang competencies data para sa napiling filters.")
        else:
            comp = competencies.copy()
            if "degree" not in comp.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                comp = comp.merge(education[["user_id", "degree"]], on="user_id", how="left")
            if comparison_mode and "degree" in comp.columns and "competency" in comp.columns:
                gp = pair_counts(comp, ["degree", "competency"])
                if not gp.empty:
                    st.plotly_chart(px.bar(gp, x="degree", y="count", color="competency", barmode="group", title="Useful Competencies per Program"), use_container_width=True)
            elif "competency" in comp.columns and not comp["competency"].dropna().empty:
                counts = comp["competency"].value_counts().reset_index()
                counts.columns = ["competency", "count"]
                st.plotly_chart(px.bar(counts, x="competency", y="count", title="Useful Competencies"), use_container_width=True)

        if suggestions is None or suggestions.empty:
            st.info("Walang curriculum suggestions para sa napiling filters.")
        else:
            s = suggestions.copy()
            if "degree" not in s.columns and education is not None and "user_id" in education.columns and "degree" in education.columns:
                s = s.merge(education[["user_id", "degree"]], on="user_id", how="left")
            if comparison_mode and "degree" in s.columns and "suggestion" in s.columns:
                st.write("**Curriculum Suggestions (filtered per program)**")
                st.dataframe(s[["degree", "user_id", "suggestion"]].sort_values("degree"))
            elif "suggestion" in s.columns:
                st.write("**Curriculum Suggestions**")
                st.dataframe(s[["user_id", "suggestion"]])

        export_download(competencies, "competencies_data")

# =============================
# RUN APP
# =============================
def run_app():
    main_dashboard()
    if st.sidebar.button("🔄 Refresh"):
        st.rerun()

if __name__ == "__main__":
    run_app()
