import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime
import mysql.connector
import warnings
import io
warnings.filterwarnings('ignore')

# Page configuration
st.set_page_config(
    page_title="Alumify Analytics Dashboard",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Enhanced Custom CSS with Plotly-inspired design
st.markdown("""
<style>
    /* PRINCIPLE 1: Clear Visual Hierarchy */
    .main-header {
        font-size: 2.5rem;
        color: #2C3E50;
        text-align: center;
        margin-bottom: 1.5rem;
        font-weight: 700;
        border-bottom: 3px solid #3498DB;
        padding-bottom: 0.5rem;
    }
    
    .section-header {
        font-size: 1.4rem;
        color: #2C3E50;
        margin: 2rem 0 1rem 0;
        font-weight: 600;
        padding: 0.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
        text-align: center;
    }
    
    .subsection-header {
        font-size: 1.1rem;
        color: #34495E;
        margin: 1.5rem 0 0.5rem 0;
        font-weight: 600;
        border-left: 4px solid #3498DB;
        padding-left: 0.5rem;
    }
    
    /* PRINCIPLE 2: Strategic Use of Color - Plotly Inspired */
    .metric-card {
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
        padding: 1.5rem;
        border-radius: 12px;
        color: white;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease;
        border: 1px solid #E2E8F0;
    }
    
    .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }
    
    .metric-value {
        font-size: 2.2rem;
        font-weight: 700;
        margin: 0.5rem 0;
    }
    
    .metric-label {
        font-size: 0.9rem;
        opacity: 0.9;
        margin-bottom: 0.5rem;
    }
    
    .metric-delta {
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    /* PRINCIPLE 3: Consistent Layout & Spacing */
    .chart-container {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        margin-bottom: 1.5rem;
        border: 1px solid #E8E8E8;
    }
    
    .filter-section {
        background: #F8F9FA;
        padding: 1.2rem;
        border-radius: 10px;
        margin-bottom: 1.5rem;
        border: 1px solid #E9ECEF;
    }
    
    /* Storytelling Elements */
    .story-card {
        background: linear-gradient(135deg, #F0F4FF 0%, #E6F3FF 100%);
        padding: 1.5rem;
        border-radius: 12px;
        margin: 1rem 0;
        border-left: 5px solid #6366F1;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
    }
    
    .insight-highlight {
        background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
        border: 1px solid #F59E0B;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        font-style: italic;
    }
    
    .narrative-text {
        font-size: 1.1rem;
        line-height: 1.6;
        color: #374151;
        padding: 1rem;
        background: white;
        border-radius: 8px;
        border-left: 4px solid #10B981;
    }
    
    .alert-card {
        background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%);
        border: 1px solid #EF4444;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    
    .strategic-insight {
        background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%);
        border: 1px solid #22C55E;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        font-size: 0.9rem;
    }
    
    /* Plotly-inspired color scheme */
    .plotly-primary { color: #6366F1; }
    .plotly-secondary { color: #8B5CF6; }
    .plotly-success { color: #10B981; }
    .plotly-warning { color: #F59E0B; }
    .plotly-danger { color: #EF4444; }
    
    /* Navigation styling */
    .nav-container {
        display: flex;
        justify-content: center;
        margin-bottom: 2rem;
        background: #F8F9FA;
        padding: 0.5rem;
        border-radius: 12px;
        gap: 1rem;
    }
    
    .nav-button {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 600;
        border: none;
        background: transparent;
        color: #4B5563;
        text-decoration: none;
        display: inline-block;
    }
    
    .nav-button:hover {
        background: #6366F1;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
    }
    
    .nav-button.active {
        background: #6366F1;
        color: white;
        box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
    }
    
    /* Data Explorer Styling */
    .data-table {
        font-size: 0.85rem;
    }
    
    .column-header {
        font-weight: 600;
        background-color: #f0f0f0;
    }
</style>
""", unsafe_allow_html=True)

class AlumifyDashboard:
    def __init__(self):
        self.connection = self.create_connection()
        if self.connection:
            self.load_data()
        else:
            st.error("Cannot connect to database. Please check your MySQL connection.")
            st.stop()
    
    def create_connection(self):
        """Create database connection"""
        try:
            conn = mysql.connector.connect(
                host='127.0.0.1',
                user='root',
                password='',
                database='alumify',
                autocommit=True
            )
            return conn
        except Exception as e:
            st.error(f"Database connection error: {e}")
            return None
    
    def refresh_data(self):
        """Refresh all data from database"""
        if self.connection:
            try:
                self.load_data()
                return True
            except Exception as e:
                st.error(f"Error refreshing data: {e}")
                return False
        return False
    
    def load_data(self):
        """Load all data from database"""
        with st.spinner('Loading live data from database...'):
            # Load users data - EXCLUDE ADMIN from the start
            self.users_df = pd.read_sql("SELECT * FROM users WHERE role != 'admin'", self.connection)
            
            # Load activity logs
            self.activity_df = pd.read_sql("SELECT * FROM activity_logs", self.connection)
            
            # Load educational background
            self.education_df = pd.read_sql("SELECT * FROM educational_background", self.connection)
            
            # Load employment data
            self.employment_df = pd.read_sql("SELECT * FROM employment_data", self.connection)
            
            # Load graduate profiles
            self.profiles_df = pd.read_sql("SELECT * FROM graduate_profiles", self.connection)
            
            # Load survey responses
            self.survey_df = pd.read_sql("SELECT * FROM survey_responses", self.connection)
            
            # Load course reasons
            self.course_reasons_df = pd.read_sql("SELECT * FROM course_reasons", self.connection)
            
            # Load unemployment reasons
            self.unemployment_df = pd.read_sql("SELECT * FROM unemployment_reasons", self.connection)
            
            # Load useful competencies
            self.competencies_df = pd.read_sql("SELECT * FROM useful_competencies", self.connection)
            
            # Create merged dataset for comprehensive analysis
            self.create_merged_data()
    
    def create_merged_data(self):
        """Create comprehensive merged dataset"""
        # Merge users with profiles
        merged = self.users_df.merge(
            self.profiles_df, left_on='id', right_on='user_id', how='left', suffixes=('', '_profile')
        )
        
        # Merge with education
        merged = merged.merge(
            self.education_df, left_on='id', right_on='user_id', how='left', suffixes=('', '_edu')
        )
        
        # Merge with employment
        merged = merged.merge(
            self.employment_df, left_on='id', right_on='user_id', how='left', suffixes=('', '_emp')
        )
        
        # Merge with survey responses
        merged = merged.merge(
            self.survey_df, left_on='id', right_on='user_id', how='left', suffixes=('', '_survey')
        )
        
        # Fix decimal years by converting to integers where appropriate
        if 'year_graduated' in merged.columns:
            merged['year_graduated'] = merged['year_graduated'].fillna(0).astype(int)
            # Replace 0 with NaN to maintain data integrity
            merged['year_graduated'] = merged['year_graduated'].replace(0, np.nan)
        
        self.merged_df = merged

def create_enhanced_filters(dashboard):
    """Create enhanced filters with clear visual hierarchy"""
    st.sidebar.markdown("### Dashboard Controls")
    
    # Refresh button with better styling
    col1, col2 = st.sidebar.columns([3, 1])
    with col1:
        if st.button("Refresh Live Data", use_container_width=True):
            if dashboard.refresh_data():
                st.sidebar.success("Data refreshed!")
            else:
                st.sidebar.error("Refresh failed")
    
    st.sidebar.markdown("---")
    st.sidebar.markdown("### Display Filters")
    
    # Time period filter
    st.sidebar.markdown("**Time Period**")
    time_period = st.sidebar.selectbox(
        "Select Time Range:",
        ["All Time", "Last 30 Days", "Last 90 Days", "Last Year"],
        label_visibility="collapsed"
    )
    
    # Program/degree filter with search
    st.sidebar.markdown("**Academic Programs**")
    programs = ['All Programs'] + sorted(dashboard.education_df['degree'].dropna().unique().tolist())
    selected_programs = st.sidebar.multiselect(
        "Select Programs:",
        options=programs,
        default=['All Programs'],
        help="Filter by academic program",
        label_visibility="collapsed"
    )
    
    # Graduation year with range slider - FIXED: Ensure integer values
    st.sidebar.markdown("**Graduation Years**")
    years = sorted(dashboard.education_df['year_graduated'].dropna().unique().tolist())
    # Convert years to integers to remove decimals
    years = [int(year) for year in years if pd.notna(year)]
    if years:
        year_range = st.sidebar.slider(
            "Select Year Range:",
            min_value=min(years),
            max_value=max(years),
            value=(min(years), max(years)),
            label_visibility="collapsed"
        )
    else:
        year_range = (2020, 2025)
    
    # Demographic filters
    st.sidebar.markdown("**Demographics**")
    col1, col2 = st.sidebar.columns(2)
    with col1:
        genders = ['All'] + dashboard.profiles_df['sex'].dropna().unique().tolist()
        selected_gender = st.selectbox("Gender", genders)
    with col2:
        employment_statuses = ['All'] + dashboard.employment_df['is_employed'].dropna().unique().tolist()
        selected_employment = st.selectbox("Employment", employment_statuses)
    
    return {
        'time_period': time_period,
        'programs': selected_programs,
        'year_range': year_range,
        'gender': selected_gender,
        'employment_status': selected_employment
    }

def apply_enhanced_filters(dashboard, filters):
    """Apply enhanced filters with better logic"""
    filtered_df = dashboard.merged_df.copy()
    
    # Apply program filter
    if 'All Programs' not in filters['programs'] and filters['programs']:
        filtered_df = filtered_df[filtered_df['degree'].isin(filters['programs'])]
    
    # Apply year range filter - FIXED: Ensure integer comparison
    filtered_df = filtered_df[
        (filtered_df['year_graduated'] >= filters['year_range'][0]) & 
        (filtered_df['year_graduated'] <= filters['year_range'][1])
    ]
    
    # Apply gender filter
    if filters['gender'] != 'All':
        filtered_df = filtered_df[filtered_df['sex'] == filters['gender']]
    
    # Apply employment status filter
    if filters['employment_status'] != 'All':
        filtered_df = filtered_df[filtered_df['is_employed'] == filters['employment_status']]
    
    return filtered_df

def generate_ai_narrative(dashboard, filtered_df, filters):
    """Generate AI-assisted narrative text based on current filters and data"""
    
    # Calculate key metrics for narrative - FIXED: Use actual total alumni count (excluding admin)
    total_alumni = len(dashboard.users_df)  # Already excludes admin
    filtered_alumni = len(filtered_df)
    employed_count = len(filtered_df[filtered_df['is_employed'] == 'Yes'])
    employment_rate = (employed_count / filtered_alumni) * 100 if filtered_alumni > 0 else 0
    
    # Program-specific metrics
    if 'All Programs' not in filters['programs'] and filters['programs']:
        program_text = f"<span class='plotly-primary'>{', '.join(filters['programs'])}</span>"
    else:
        program_text = "all programs"
    
    # Year range text - FIXED: Remove decimals from year display
    year_start = int(filters['year_range'][0])
    year_end = int(filters['year_range'][1])
    year_text = f"from <span class='plotly-primary'>{year_start}</span> to <span class='plotly-primary'>{year_end}</span>"
    
    # Gender text
    gender_text = f"<span class='plotly-secondary'>{filters['gender']}</span>" if filters['gender'] != 'All' else "all genders"
    
    # Build the narrative
    narrative_parts = []
    
    # Main overview with corrected counts
    narrative_parts.append(f"""
    <div class='narrative-text'>
        <strong>Current Analysis:</strong> Showing <span class='plotly-primary'>{filtered_alumni}</span> of <span class='plotly-primary'>{total_alumni}</span> total alumni (excluding admin) from {program_text} 
        who graduated {year_text}. Current employment rate: <span class='plotly-success'>{employment_rate:.0f}%</span> 
        ({employed_count} employed out of {filtered_alumni} filtered alumni).
    </div>
    """)
    
    return "\n".join(narrative_parts)

def create_strategic_kpi_metrics(dashboard, filtered_df):
    """Create KPI metrics following strategic design principles"""
    st.markdown('<div class="main-header">Alumify Strategic Dashboard</div>', unsafe_allow_html=True)
    
    # Calculate strategic metrics - FIXED: Use correct counts (excluding admin)
    total_alumni = len(dashboard.users_df)  # Already excludes admin
    filtered_alumni = len(filtered_df)
    employed_count = len(filtered_df[filtered_df['is_employed'] == 'Yes'])
    employment_rate = (employed_count / filtered_alumni) * 100 if filtered_alumni > 0 else 0
    
    # FIXED: Survey completion based on actual survey responses (excluding admin)
    completed_surveys = len(dashboard.survey_df[dashboard.survey_df['is_completed'] == 1])
    survey_completion_rate = (completed_surveys / total_alumni) * 100 if total_alumni > 0 else 0
    
    recent_activity = len(dashboard.activity_df)
    
    # Program diversity
    program_diversity = filtered_df['degree'].nunique()
    
    # Create metric cards with strategic color coding
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">TOTAL ALUMNI</div>
            <div class="metric-value">{total_alumni}</div>
            <div class="metric-delta">{filtered_alumni} Filtered</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">EMPLOYMENT RATE</div>
            <div class="metric-value">{employment_rate:.0f}%</div>
            <div class="metric-delta">{employed_count} Employed</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">SURVEY COMPLETION</div>
            <div class="metric-value">{survey_completion_rate:.0f}%</div>
            <div class="metric-delta">{completed_surveys} Completed</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">ACTIVITIES</div>
            <div class="metric-value">{recent_activity}</div>
            <div class="metric-delta">Total Engagements</div>
        </div>
        """, unsafe_allow_html=True)

def create_plotly_enhanced_visualizations(dashboard, filtered_df, filters):
    """Create enhanced Plotly visualizations with better storytelling and strategic insights"""
    
    # Use Plotly's built-in color scales
    qualitative_scale = px.colors.qualitative.Plotly
    
    # Row 1: Employment Overview with Strategic Insights
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown('<div class="subsection-header">Employment Distribution</div>', unsafe_allow_html=True)
        if not filtered_df.empty and 'is_employed' in filtered_df.columns:
            employment_data = filtered_df['is_employed'].value_counts()
            
            fig = px.pie(
                values=employment_data.values,
                names=employment_data.index,
                title="",
                color=employment_data.index,
                color_discrete_sequence=qualitative_scale
            )
            fig.update_traces(
                textposition='inside',
                textinfo='percent+label',
                hole=0.4,
                marker=dict(line=dict(color='white', width=2)),
                hovertemplate='<b>%{label}</b><br>%{value} alumni<br>%{percent}<extra></extra>'
            )
            fig.update_layout(
                height=400,
                showlegend=False,
                annotations=[dict(text='Employment', x=0.5, y=0.5, font_size=16, showarrow=False)]
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Strategic Insight for Employment Distribution
            employed_count = employment_data.get('Yes', 0)
            total_count = employment_data.sum()
            employment_rate = (employed_count / total_count * 100) if total_count > 0 else 0
            
            if employment_rate >= 70:
                st.markdown(f"""
                <div class="strategic-insight">
                    <strong>Strong Performance:</strong> {employment_rate:.0f}% employment rate exceeds targets. 
                    Focus on maintaining industry partnerships and career development programs.
                </div>
                """, unsafe_allow_html=True)
            elif employment_rate >= 50:
                st.markdown(f"""
                <div class="insight-highlight">
                    <strong>Growth Opportunity:</strong> {employment_rate:.0f}% employment rate shows potential. 
                    Consider enhancing internship programs and alumni networking.
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class="alert-card">
                    <strong>Action Required:</strong> {employment_rate:.0f}% employment rate needs improvement. 
                    Review curriculum alignment with industry needs and strengthen career services.
                </div>
                """, unsafe_allow_html=True)
    
    with col2:
        st.markdown('<div class="subsection-header">Program Performance</div>', unsafe_allow_html=True)
        if not filtered_df.empty and 'degree' in filtered_df.columns:
            program_performance = filtered_df.groupby('degree').apply(
                lambda x: (x['is_employed'] == 'Yes').sum() / len(x) * 100 if len(x) > 0 else 0
            ).reset_index(name='employment_rate')
            
            if len(program_performance) > 0:
                # Round employment rates to whole numbers
                program_performance['employment_rate'] = program_performance['employment_rate'].round(0)
                
                fig = px.bar(
                    program_performance.sort_values('employment_rate', ascending=True).tail(8),
                    x='employment_rate',
                    y='degree',
                    orientation='h',
                    title="",
                    labels={'employment_rate': 'Employment Rate (%)', 'degree': 'Program'},
                    color='employment_rate',
                    color_continuous_scale='Viridis'
                )
                fig.update_layout(
                    height=400,
                    showlegend=False,
                    xaxis_title="Employment Rate (%)",
                    yaxis_title=""
                )
                fig.update_traces(
                    hovertemplate='<b>%{y}</b><br>Employment Rate: %{x}%<extra></extra>'
                )
                st.plotly_chart(fig, use_container_width=True)
                
                # Strategic Insight for Program Performance
                if len(program_performance) > 1:
                    top_program = program_performance.loc[program_performance['employment_rate'].idxmax()]
                    bottom_program = program_performance.loc[program_performance['employment_rate'].idxmin()]
                    
                    if top_program['employment_rate'] - bottom_program['employment_rate'] > 20:
                        st.markdown(f"""
                        <div class="strategic-insight">
                            <strong>Program Excellence:</strong> {top_program['degree']} leads with {top_program['employment_rate']:.0f}% employment. 
                            Document and share best practices across departments.
                        </div>
                        """, unsafe_allow_html=True)
    
    # Row 2: Trends and Demographics with Strategic Insights
    col3, col4 = st.columns(2)
    
    with col3:
        st.markdown('<div class="subsection-header">Graduation Timeline</div>', unsafe_allow_html=True)
        if not filtered_df.empty and 'year_graduated' in filtered_df.columns:
            # FIXED: Ensure years are integers and remove NaN values
            grad_data = filtered_df[['year_graduated']].dropna()
            if not grad_data.empty:
                grad_data['year_graduated'] = grad_data['year_graduated'].astype(int)
                grad_trend = grad_data['year_graduated'].value_counts().sort_index()
                
                if len(grad_trend) > 0:
                    fig = px.area(
                        x=grad_trend.index,
                        y=grad_trend.values,
                        title="",
                        labels={'x': 'Graduation Year', 'y': 'Number of Graduates'},
                        color_discrete_sequence=[qualitative_scale[0]]
                    )
                    fig.update_layout(
                        height=350,
                        xaxis_title="Graduation Year",
                        yaxis_title="Number of Graduates"
                    )
                    fig.update_traces(
                        fill='tozeroy', 
                        line=dict(width=3),
                        hovertemplate='<b>Year: %{x}</b><br>Graduates: %{y}<extra></extra>'
                    )
                    # FIXED: Format x-axis to show integers without decimals
                    fig.update_xaxes(tickformat='d')
                    st.plotly_chart(fig, use_container_width=True)
                    
                    # Strategic Insight for Graduation Trends
                    recent_grads = grad_trend.tail(3).sum()
                    if recent_grads > grad_trend.mean():
                        st.markdown(f"""
                        <div class="strategic-insight">
                            <strong>Growing Impact:</strong> {int(recent_grads)} recent graduates in last 3 years. 
                            Strong pipeline for alumni engagement and networking opportunities.
                        </div>
                        """, unsafe_allow_html=True)
    
    with col4:
        st.markdown('<div class="subsection-header">Industry Placement</div>', unsafe_allow_html=True)
        if not filtered_df.empty and 'business_line' in filtered_df.columns:
            industries = filtered_df['business_line'].value_counts().head(6)
            
            if len(industries) > 0:
                # Remove decimals from industry counts - convert to integers
                industries_clean = industries.astype(int)
                
                fig = px.bar(
                    x=industries_clean.values,
                    y=industries_clean.index,
                    orientation='h',
                    title="",
                    labels={'x': 'Number of Alumni', 'y': 'Industry'},
                    color=industries_clean.values,
                    color_continuous_scale='Blues'
                )
                fig.update_layout(
                    height=350,
                    showlegend=False,
                    xaxis_title="Number of Alumni",
                    yaxis_title=""
                )
                # Remove decimals from x-axis and hover text
                fig.update_xaxes(tickformat='d')
                fig.update_traces(
                    hovertemplate='<b>%{y}</b><br>Alumni Count: %{x}<extra></extra>',
                    texttemplate='%{x}',
                    textposition='outside'
                )
                # Remove color bar to avoid decimal display
                fig.update_coloraxes(showscale=False)
                st.plotly_chart(fig, use_container_width=True)
                
                # Strategic Insight for Industry Placement
                top_industry = industries_clean.index[0]
                top_count = industries_clean.iloc[0]
                st.markdown(f"""
                <div class="strategic-insight">
                    <strong>Industry Leader:</strong> {top_industry} employs {top_count} alumni. 
                    Strengthen partnerships and recruitment opportunities in this sector.
                </div>
                """, unsafe_allow_html=True)

def create_actionable_insights(dashboard, filtered_df):
    """Create actionable insights section"""
    st.markdown('<div class="section-header">Strategic Insights & Recommendations</div>', unsafe_allow_html=True)
    
    # Calculate insights
    total_alumni = len(dashboard.users_df)
    filtered_alumni = len(filtered_df)
    employed_rate = (len(filtered_df[filtered_df['is_employed'] == 'Yes']) / filtered_alumni) * 100 if filtered_alumni > 0 else 0
    
    # FIXED: Use actual survey completion data
    completed_surveys = len(dashboard.survey_df[dashboard.survey_df['is_completed'] == 1])
    survey_rate = (completed_surveys / total_alumni) * 100 if total_alumni > 0 else 0
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Performance insights
        st.markdown('<div class="subsection-header">Performance Metrics</div>', unsafe_allow_html=True)
        
        if employed_rate < 50:
            st.markdown(f"""
            <div class="alert-card">
                <strong>Attention Needed:</strong> Employment rate ({employed_rate:.0f}%) is below target. 
                Consider career development programs and industry partnerships.
            </div>
            """, unsafe_allow_html=True)
        elif employed_rate < 70:
            st.markdown(f"""
            <div class="insight-highlight">
                <strong>Growth Opportunity:</strong> Employment rate at {employed_rate:.0f}% has room for improvement. 
                Focus on internship programs and career counseling.
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="story-card">
                <strong>Strong Performance:</strong> Employment rate at {employed_rate:.0f}% exceeds expectations. 
                Consider scaling successful initiatives to other programs.
            </div>
            """, unsafe_allow_html=True)
        
        if survey_rate < 60:
            st.markdown(f"""
            <div class="alert-card">
                <strong>Engagement Opportunity:</strong> Survey completion rate ({survey_rate:.0f}%) is low. 
                Implement targeted survey reminder campaigns and incentives.
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="story-card">
                <strong>Good Engagement:</strong> {survey_rate:.0f}% survey completion indicates strong alumni involvement.
                Leverage this for deeper insights and networking opportunities.
            </div>
            """, unsafe_allow_html=True)
    
    with col2:
        # Program insights
        st.markdown('<div class="subsection-header">Program Analysis</div>', unsafe_allow_html=True)
        
        # Top programs by employment
        program_employment = filtered_df.groupby('degree').apply(
            lambda x: (x['is_employed'] == 'Yes').sum() / len(x) * 100 if len(x) > 0 else 0
        ).sort_values(ascending=False)
        
        if len(program_employment) > 0:
            top_program = program_employment.index[0]
            top_rate = program_employment.iloc[0]
            
            st.markdown(f"""
            <div class="story-card">
                <strong>Top Performer:</strong> {top_program} program has {top_rate:.0f}% employment rate.
                Document best practices for knowledge sharing across departments.
            </div>
            """, unsafe_allow_html=True)
            
            if len(program_employment) > 1:
                bottom_program = program_employment.index[-1]
                bottom_rate = program_employment.iloc[-1]
                
                st.markdown(f"""
                <div class="alert-card">
                    <strong>Improvement Opportunity:</strong> {bottom_program} program at {bottom_rate:.0f}% employment needs support.
                    Consider curriculum review and industry alignment assessment.
                </div>
                """, unsafe_allow_html=True)

def create_data_explorer(dashboard, filtered_df):
    """Create enhanced Data Explorer with better field names and organization"""
    st.markdown('<div class="section-header">Data Explorer</div>', unsafe_allow_html=True)
    
    if not filtered_df.empty:
        # Data Explorer Filters - SIMPLIFIED: Removed survey status
        st.markdown("### Data Controls")
        col1, col2 = st.columns(2)
        
        with col1:
            # Record limit selector
            record_limit = st.selectbox(
                "Show Records:",
                [10, 25, 50, 100, "All"],
                index=1,
                help="Limit the number of records displayed"
            )
        
        with col2:
            # Sort options
            sort_by = st.selectbox(
                "Sort By:",
                ["Name", "Graduation Year", "Employment Status"],
                help="Sort the data table"
            )
        
        # Apply record limit
        if record_limit != "All":
            display_df = filtered_df.head(record_limit)
        else:
            display_df = filtered_df.copy()
        
        # Apply sorting
        sort_mapping = {
            "Name": "name",
            "Graduation Year": "year_graduated",
            "Employment Status": "is_employed"
        }
        if sort_by in sort_mapping:
            sort_column = sort_mapping[sort_by]
            if sort_column in display_df.columns:
                display_df = display_df.sort_values(sort_column, ascending=(sort_by != "Graduation Year"))
        
        # Show key metrics first - FIXED: Exclude admin from all counts
        total_alumni_no_admin = len(dashboard.users_df)  # Already excludes admin
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Alumni (Excluding Admin)", total_alumni_no_admin)
        with col2:
            st.metric("Filtered Records", len(filtered_df))
        with col3:
            st.metric("Displayed Records", len(display_df))
        with col4:
            completed_count = len(dashboard.survey_df[dashboard.survey_df['is_completed'] == 1])
            st.metric("Completed Surveys", completed_count)
        
        # Create a cleaned dataframe with better field names
        display_df_clean = display_df.copy()
        
        # Remove unwanted columns
        columns_to_remove = ['google_id', 'region_of_origin', 'province', 'location_type']
        for col in columns_to_remove:
            if col in display_df_clean.columns:
                display_df_clean = display_df_clean.drop(columns=[col])
        
        # Rename columns for better readability
        column_mapping = {
            'id': 'User ID',
            'name': 'Full Name',
            'email': 'Email Address',
            'role': 'User Role',
            'privacy_accepted': 'Privacy Accepted',
            'created_at': 'Account Created',
            'updated_at': 'Last Updated',
            'permanent_address': 'Permanent Address',
            'telephone': 'Telephone',
            'mobile_number': 'Mobile Number',
            'civil_status': 'Civil Status',
            'sex': 'Gender',
            'birthday': 'Birth Date',
            'degree': 'Degree Program',
            'specialization': 'Specialization',
            'college_university': 'University',
            'year_graduated': 'Graduation Year',
            'honors_awards': 'Honors & Awards',
            'is_employed': 'Employment Status',
            'employment_status': 'Employment Type',
            'present_occupation': 'Current Occupation',
            'business_line': 'Industry',
            'place_of_work': 'Work Location',
            'is_first_job': 'First Job',
            'job_level_first': 'First Job Level',
            'job_level_current': 'Current Job Level',
            'initial_gross_monthly_earning': 'Initial Salary',
            'curriculum_relevant': 'Curriculum Relevant',
            'is_completed': 'Survey Status',
            'completed_at': 'Survey Completed At'
        }
        
        # Apply column renaming
        display_df_clean = display_df_clean.rename(columns=column_mapping)
        
        # Convert survey status from 1/0 to Completed/Not Completed
        if 'Survey Status' in display_df_clean.columns:
            display_df_clean['Survey Status'] = display_df_clean['Survey Status'].apply(
                lambda x: 'Completed' if x == 1 else 'Not Completed'
            )
        
        # FIXED: Ensure graduation year displays as integer without decimals
        if 'Graduation Year' in display_df_clean.columns:
            display_df_clean['Graduation Year'] = display_df_clean['Graduation Year'].fillna(0).astype(int)
            display_df_clean['Graduation Year'] = display_df_clean['Graduation Year'].replace(0, '')
        
        # Keep only the most relevant columns for display
        key_columns = [
            'Full Name', 'Email Address', 'Degree Program', 'Graduation Year', 
            'Gender', 'Employment Status', 'Current Occupation', 'Industry',
            'Work Location', 'Survey Status'
        ]
        
        # Filter to only include columns that exist in the dataframe
        available_columns = [col for col in key_columns if col in display_df_clean.columns]
        display_df_clean = display_df_clean[available_columns]
        
        # Data preview with better organization
        st.markdown("### Alumni Records")
        st.dataframe(display_df_clean, use_container_width=True)
        
        # Export options
        st.markdown("### Export Data")
        col1, col2 = st.columns(2)
        with col1:
            csv = display_df_clean.to_csv(index=False)
            st.download_button(
                label="Download CSV",
                data=csv,
                file_name=f"alumni_data_{datetime.now().strftime('%Y%m%d')}.csv",
                mime="text/csv",
                use_container_width=True
            )
        with col2:
            excel_buffer = io.BytesIO()
            display_df_clean.to_excel(excel_buffer, index=False, engine='openpyxl')
            st.download_button(
                label="Download Excel",
                data=excel_buffer.getvalue(),
                file_name=f"alumni_data_{datetime.now().strftime('%Y%m%d')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True
            )
    else:
        st.info("No data available with the current filters.")

def create_spa_navigation():
    """Create Single Page Application navigation without deprecated query parameters"""
    # Initialize session state for navigation
    if 'nav_section' not in st.session_state:
        st.session_state.nav_section = "Executive Overview"
    
    # Simple navigation using buttons without deprecated functions
    st.markdown("### Navigation")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Executive Overview", use_container_width=True, 
                    type="primary" if st.session_state.nav_section == "Executive Overview" else "secondary"):
            st.session_state.nav_section = "Executive Overview"
    with col2:
        if st.button("Data Explorer", use_container_width=True,
                    type="primary" if st.session_state.nav_section == "Data Explorer" else "secondary"):
            st.session_state.nav_section = "Data Explorer"
    
    st.markdown("---")
    return st.session_state.nav_section

def main():
    # Initialize dashboard
    dashboard = AlumifyDashboard()
    
    # Sidebar with enhanced navigation
    st.sidebar.markdown("""
    <div style='text-align: center; margin-bottom: 2rem;'>
        <h2>Alumify</h2>
        <p style='color: #666; font-size: 0.9rem;'>Strategic Alumni Analytics</p>
    </div>
    """, unsafe_allow_html=True)
    
    st.sidebar.success("Live Database Connected")
    st.sidebar.markdown("---")
    
    # Enhanced filters - now only for counting/showing
    st.sidebar.markdown("### Display Filters")
    filters = create_enhanced_filters(dashboard)
    
    # Apply filters
    filtered_df = apply_enhanced_filters(dashboard, filters)
    
    # Clean Navigation without deprecated functions
    selected_nav = create_spa_navigation()
    
    # Display AI-generated narrative (appears on all pages)
    narrative = generate_ai_narrative(dashboard, filtered_df, filters)
    st.markdown(narrative, unsafe_allow_html=True)
    
    # Display selected section
    if selected_nav == "Executive Overview":
        create_strategic_kpi_metrics(dashboard, filtered_df)
        create_plotly_enhanced_visualizations(dashboard, filtered_df, filters)
        create_actionable_insights(dashboard, filtered_df)
        
    elif selected_nav == "Data Explorer":
        create_data_explorer(dashboard, filtered_df)
    
    # Footer with data quality info - FIXED: Use correct counts (excluding admin)
    st.sidebar.markdown("---")
    st.sidebar.markdown("""
    **Data Quality:**
    - {} Total Alumni
    - {} Employment Records  
    - {} Completed Surveys
    - Updated: {}
    """.format(
        len(dashboard.users_df),  # Already excludes admin
        len(dashboard.employment_df),
        len(dashboard.survey_df[dashboard.survey_df['is_completed'] == 1]),
        datetime.now().strftime("%Y-%m-%d %H:%M")
    ))

if __name__ == "__main__":
    main()