"""
MMM Studio - Marketing Mix Modeling Dashboard

A Streamlit application for building and analyzing multiplicative
Marketing Mix Models.

Run with: streamlit run dashboard/app.py
"""

import streamlit as st
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dashboard.utils import init_session_state, get_workflow_progress, THEME_COLORS


def setup_page_config():
    """Configure Streamlit page settings."""
    st.set_page_config(
        page_title="MMM Studio",
        page_icon="📊",
        layout="wide",
        initial_sidebar_state="expanded",
    )


def apply_custom_css():
    """Apply custom CSS styling."""
    st.markdown("""
    <style>
    /* Dark theme overrides */
    .stApp {
        background-color: #0F172A;
    }

    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background-color: #1E293B;
    }

    /* Card styling */
    .metric-card {
        background-color: #1E293B;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px;
    }

    /* Progress bar */
    .stProgress > div > div {
        background-color: #4F46E5;
    }

    /* Headers */
    h1, h2, h3 {
        color: #F1F5F9;
    }

    /* Muted text */
    .muted {
        color: #94A3B8;
    }

    /* Success text */
    .success {
        color: #10B981;
    }

    /* Error text */
    .error {
        color: #EF4444;
    }

    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    </style>
    """, unsafe_allow_html=True)


def render_sidebar():
    """Render the sidebar navigation."""
    with st.sidebar:
        # Logo and title
        st.markdown("### 📊 MMM Studio")
        st.markdown("---")

        # Navigation sections
        st.markdown("**DATA**")

        pages = {
            "Data Upload": "pages/01_Data_Upload.py",
            "Data Exploration": "pages/02_Data_Exploration.py",
            "Column Mapping": "pages/03_Column_Mapping.py",
        }

        # Model section
        st.markdown("")
        st.markdown("**MODEL**")

        pages.update({
            "Configuration": "pages/04_Model_Config.py",
            "Training": "pages/05_Model_Training.py",
            "Results": "pages/06_Results.py",
        })

        # Planning section
        st.markdown("")
        st.markdown("**PLANNING**")

        pages.update({
            "Budget Optimization": "pages/07_Budget_Optimization.py",
            "Scenario Planning": "pages/08_Scenario_Planning.py",
        })

        # Workflow progress
        st.markdown("---")
        current_step, total_steps = get_workflow_progress()
        progress = current_step / total_steps

        st.markdown("**Workflow Progress**")
        st.progress(progress)
        st.caption(f"Step {current_step} of {total_steps}")


def main():
    """Main application entry point."""
    setup_page_config()
    apply_custom_css()
    init_session_state()
    render_sidebar()

    # Main content area
    st.title("Welcome to MMM Studio")

    st.markdown("""
    **MMM Studio** helps you build and analyze Marketing Mix Models to understand
    the effectiveness of your marketing channels and optimize budget allocation.

    ### Getting Started

    1. **Upload Data** - Start by uploading your marketing spend and sales data
    2. **Explore Data** - Visualize correlations and time series patterns
    3. **Map Columns** - Identify your date, target, and media spend columns
    4. **Configure Model** - Choose model type and set parameters
    5. **Train Model** - Run Bayesian inference to estimate channel effects
    6. **Analyze Results** - Review elasticities, contributions, and ROI
    7. **Optimize Budget** - Find the optimal allocation across channels
    8. **Plan Scenarios** - Test different budget scenarios

    ### Quick Start

    Use the sidebar navigation to move through the workflow, or click below to begin:
    """)

    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("📤 Upload Data", use_container_width=True):
            st.switch_page("pages/01_Data_Upload.py")

    with col2:
        if st.button("📊 View Results", use_container_width=True):
            st.switch_page("pages/06_Results.py")

    with col3:
        if st.button("💰 Optimize Budget", use_container_width=True):
            st.switch_page("pages/07_Budget_Optimization.py")

    # Status cards
    st.markdown("---")
    st.markdown("### Current Status")

    status_col1, status_col2, status_col3, status_col4 = st.columns(4)

    with status_col1:
        data_loaded = st.session_state.get('data_loaded', False)
        st.metric(
            "Data",
            "Loaded" if data_loaded else "Not loaded",
            delta=None,
        )

    with status_col2:
        model_trained = st.session_state.get('model_trained', False)
        st.metric(
            "Model",
            "Trained" if model_trained else "Not trained",
            delta=None,
        )

    with status_col3:
        n_channels = len(st.session_state.get('media_columns', []))
        st.metric(
            "Channels",
            str(n_channels) if n_channels > 0 else "-",
            delta=None,
        )

    with status_col4:
        optimization_done = st.session_state.get('optimization_results') is not None
        st.metric(
            "Optimization",
            "Complete" if optimization_done else "Pending",
            delta=None,
        )


if __name__ == "__main__":
    main()
