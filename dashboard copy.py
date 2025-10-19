import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import mysql.connector
import time
from threading import Thread, Event
from queue import Queue

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
                st.session_state.db_connection_error = False
                return conn
        except mysql.connector.Error:
            st.session_state.db_connection_error = True
            if attempt == MAX_RETRIES - 1:
                st.error(f"Failed to connect to database after {MAX_RETRIES} attempts")
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
        self._initialize()
    
    def _initialize(self):
        self.conn = get_db_connection()
        if self.conn is None:
            st.error("Failed to initialize database watcher")
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
                if not self.conn or not self.conn.is_connected():
                    self.conn = get_db_connection()
                    if not self.conn:
                        time.sleep(5)
                        continue
                if self._check_tables(tables):
                    self.change_queue.put(True)
                time.sleep(DATABASE_CHECK_INTERVAL)
            except Exception as e:
                st.error(f"Watcher error: {str(e)}")
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
        except:
            return False
        finally:
            if cursor:
                cursor.close()
    
    def stop(self):
        self.stop_event.set()
        if hasattr(self, 'watch_thread') and self.watch_thread:
            self.watch_thread.join()
        if self.conn and self.conn.is_connected():
            self.conn.close()

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
        st.error(f"Database query error: {str(e)}")
        return []
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

# =============================
# LOAD DATA (with column renames)
# =============================
def load_users_data():
    df = pd.DataFrame(run_query(
        "SELECT id as user_id, email, name, role, created_at, updated_at FROM users WHERE role!='admin'"
    ))
    if not df.empty:
        df.rename(columns={"created_at": "user_created_at", "updated_at": "user_updated_at"}, inplace=True)
    return df

def load_profiles_data():
    df = pd.DataFrame(run_query(
        "SELECT id as profile_id, user_id, civil_status, sex, birthday, region_of_origin, province, created_at, updated_at FROM graduate_profiles"
    ))
    if not df.empty:
        df.rename(columns={"created_at": "profile_created_at", "updated_at": "profile_updated_at"}, inplace=True)
    return df

def load_employment_data():
    df = pd.DataFrame(run_query(
        "SELECT id as employment_id, user_id, is_employed, employment_status, present_occupation, job_level_first, job_level_current, initial_gross_monthly_earning, curriculum_relevant, created_at, updated_at FROM employment_data"
    ))
    if not df.empty:
        df.rename(columns={"created_at": "employment_created_at", "updated_at": "employment_updated_at"}, inplace=True)
    return df

def load_education_data():
    df = pd.DataFrame(run_query(
        "SELECT id as education_id, user_id, degree, specialization, year_graduated, created_at, updated_at FROM educational_background"
    ))
    if not df.empty:
        df.rename(columns={"created_at": "education_created_at", "updated_at": "education_updated_at"}, inplace=True)
    return df

def load_survey_data():
    df = pd.DataFrame(run_query(
        "SELECT id as survey_id, user_id, is_completed, completed_at, created_at, updated_at FROM survey_responses"
    ))
    if not df.empty:
        df.rename(columns={"created_at": "survey_created_at", "updated_at": "survey_updated_at"}, inplace=True)
    return df

def load_activity_data():
    df = pd.DataFrame(run_query("SELECT * FROM activity_logs"))
    if not df.empty and "created_at" in df.columns:
        df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    return df

def load_unemployment_reasons_data():
    return pd.DataFrame(run_query("SELECT * FROM unemployment_reasons"))

# =============================
# MERGE DATA
# =============================
def merge_data(users, profiles, employment, education, survey):
    try:
        return users.merge(profiles, on="user_id", how="left") \
                    .merge(employment, on="user_id", how="left") \
                    .merge(education, on="user_id", how="left") \
                    .merge(survey, on="user_id", how="left")
    except Exception as e:
        st.error(f"Merge error: {str(e)}")
        return pd.DataFrame()

# =============================
# UTILS
# =============================
def clean_export(df):
    drop_cols = [c for c in df.columns if c.endswith("_id") or c.endswith("_created_at") or c.endswith("_updated_at")]
    return df.drop(columns=drop_cols, errors="ignore")

def export_download(df, label="data_export"):
    if df.empty:
        return
    csv = clean_export(df).to_csv(index=False).encode("utf-8")
    st.download_button(
        label=f"⬇️ Download {label}.csv",
        data=csv,
        file_name=f"{label}.csv",
        mime="text/csv",
        key=f"download_{label}"
    )

def comparison_chart(df, metric, title):
    if "degree" not in df or metric not in df:
        return
    comp = df.groupby(["degree", metric]).size().reset_index(name="count")
    if comp.empty:
        return
    fig = px.bar(comp, x="degree", y="count", color=metric, barmode="stack", title=title)
    st.plotly_chart(fig, use_container_width=True)

# =============================
# MAIN DASHBOARD
# =============================
def init_app():
    st.set_page_config(page_title="Alumify Dashboard", page_icon="📊", layout="wide")
    if "db_watcher" not in st.session_state:
        st.session_state.db_watcher = DatabaseWatcher()
    if "db_connection_error" not in st.session_state:
        st.session_state.db_connection_error = False

def main_dashboard():
    init_app()
    st.title("📊 Alumify Alumni Analytics Dashboard")
    if st.session_state.db_connection_error:
        st.error("DB connection failed")
        return

    # Load data
    users = load_users_data()
    profiles = load_profiles_data()
    employment = load_employment_data()
    education = load_education_data()
    surveys = load_survey_data()
    activities = load_activity_data()
    unemployment = load_unemployment_reasons_data()

    if users.empty:
        st.warning("No alumni data")
        return
    alumni = merge_data(users, profiles, employment, education, surveys)
    if alumni.empty:
        st.warning("No merged alumni data")
        return

    # Sidebar filters
    st.sidebar.header("Filters")
    prog_opts = list(education["degree"].dropna().unique()) if not education.empty else []
    prog_compare = st.sidebar.multiselect("Select/ Compare Programs", prog_opts)

    df = alumni.copy()
    if prog_compare:
        df = df[df["degree"].isin(prog_compare)]

    # Metrics
    st.subheader("📌 Key Metrics")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Alumni", len(df))
    col2.metric("Employed", df[df["is_employed"] == "Yes"].shape[0])
    survey_rate = f"{(df['is_completed'].mean()*100):.1f}%" if "is_completed" in df.columns else "0%"
    col3.metric("Survey %", survey_rate)
    col4.metric("Relevant Jobs", df[df["curriculum_relevant"] == "Yes"].shape[0])
    export_download(df, "alumni_full_export")

    # If comparison is used
    if prog_compare and len(prog_compare) > 1:
        st.subheader("📊 Program-to-Program Comparison")
        comparison_chart(df, "is_employed", "Employment Comparison per Program")
        comparison_chart(df, "sex", "Gender Comparison per Program")
        comparison_chart(df, "civil_status", "Civil Status Comparison per Program")
    else:
        # Tabs
        tab1, tab2, tab3 = st.tabs(["Demographics", "Employment", "Engagement"])

        with tab1:
            st.subheader("👥 Demographics")
            if "sex" in df:
                st.plotly_chart(px.pie(df, names="sex", hole=0.4, title="Gender Distribution"), use_container_width=True)
                export_download(df[["name", "email", "degree", "sex"]], "gender_distribution")
            if "civil_status" in df:
                st.plotly_chart(px.bar(df["civil_status"].value_counts(), title="Civil Status"), use_container_width=True)
                export_download(df[["name", "email", "degree", "civil_status"]], "civil_status")

        with tab2:
            st.subheader("💼 Employment")
            if "is_employed" in df:
                st.plotly_chart(px.pie(df, names="is_employed", hole=0.4, title="Employment Status"), use_container_width=True)
                export_download(df[["name", "email", "degree", "is_employed"]], "employment_status")
            if not unemployment.empty and "reason" in unemployment:
                st.plotly_chart(px.bar(unemployment["reason"].value_counts(), title="Unemployment Reasons"), use_container_width=True)
                export_download(unemployment, "unemployment_reasons")
            if "year_graduated" in df and "is_employed" in df:
                grad_emp = df.groupby(["year_graduated", "is_employed"]).size().reset_index(name="count")
                st.plotly_chart(px.bar(grad_emp, x="year_graduated", y="count", color="is_employed",
                                       barmode="stack", title="Employment Trend by Graduation Year"), use_container_width=True)
            if "initial_gross_monthly_earning" in df:
                st.plotly_chart(px.box(df, x="degree", y="initial_gross_monthly_earning",
                                       title="Salary Distribution per Program"), use_container_width=True)

        with tab3:
            st.subheader("📱 Engagement")
            if activities.empty:
                st.warning("No activity data")
            else:
                st.plotly_chart(px.bar(activities["activity_type"].value_counts(), title="Activity Types"), use_container_width=True)
                export_download(activities, "activities")

# =============================
# RUN APP
# =============================
def run_app():
    main_dashboard()
    if st.sidebar.button("🔄 Refresh"):
        st.rerun()

if __name__ == "__main__":
    run_app()
