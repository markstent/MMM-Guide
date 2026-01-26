"""Data Upload Page - Upload and preview marketing data."""

import streamlit as st
import pandas as pd
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, set_state, get_state, clear_model_state
from dashboard.data import load_file, load_sample_data, get_data_summary, detect_column_types

# Page config
st.set_page_config(page_title="Data Upload - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Data Upload")
    st.caption("Step 1 of 8")

    st.markdown("""
    Upload a CSV or Excel file containing your marketing spend and sales data.
    Your data should include:
    - A **date** column (weekly or daily)
    - A **target/KPI** column (e.g., sales, revenue, conversions)
    - **Media spend** columns for each channel
    """)

    # Upload section
    st.markdown("### Upload Your Data")

    uploaded_file = st.file_uploader(
        "Drag and drop your file here, or click to browse",
        type=['csv', 'xlsx', 'xls'],
        help="Supports CSV, XLSX, and XLS formats"
    )

    if uploaded_file is not None:
        with st.spinner("Loading file..."):
            df, error = load_file(uploaded_file)

        if error:
            st.error(f"Error: {error}")
        else:
            # Clear previous model state when new data is loaded
            clear_model_state()

            set_state('data', df)
            set_state('data_filename', uploaded_file.name)
            set_state('data_loaded', True)

            st.success(f"Successfully loaded **{uploaded_file.name}**")

    # Divider
    st.markdown("---")

    # Sample data section
    st.markdown("### Or use sample data to explore")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("""
        **Conjura MMM Dataset**

        2 years of weekly data with 6 media channels.
        Perfect for learning and testing.
        """)
        if st.button("Load Conjura Sample", use_container_width=True):
            with st.spinner("Loading sample data..."):
                df, error = load_sample_data("conjura")

            if error:
                st.error(f"Error: {error}")
            else:
                clear_model_state()
                set_state('data', df)
                set_state('data_filename', 'conjura_mmm_data.csv')
                set_state('data_loaded', True)
                st.success("Sample data loaded successfully!")
                st.rerun()

    with col2:
        st.markdown("""
        **Your Own Data**

        Upload your marketing data using the
        file uploader above.
        """)
        st.info("Supported formats: CSV, XLSX")

    # Data preview section
    if get_state('data_loaded'):
        st.markdown("---")
        st.markdown("### Data Preview")

        df = get_state('data')
        summary = get_data_summary(df)

        # Stats row
        stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)

        with stat_col1:
            st.metric("Rows", f"{summary['rows']:,}")

        with stat_col2:
            st.metric("Columns", summary['columns'])

        with stat_col3:
            if 'date_range' in summary:
                st.metric("Date Range",
                          f"{summary['date_range']['start']} to {summary['date_range']['end']}")
            else:
                st.metric("Date Range", "N/A")

        with stat_col4:
            st.metric("Missing Values", f"{summary['missing_pct']:.1f}%")

        # Auto-detect column types
        col_types = detect_column_types(df)

        if col_types['date']:
            st.info(f"📅 Detected date column(s): **{', '.join(col_types['date'])}**")

        if col_types['potential_target']:
            st.info(f"🎯 Potential target column(s): **{', '.join(col_types['potential_target'])}**")

        if col_types['potential_media']:
            st.info(f"📺 Potential media column(s): **{', '.join(col_types['potential_media'])}**")

        # Data table
        st.dataframe(
            df.head(10),
            use_container_width=True,
            hide_index=True,
        )

        # Column info
        with st.expander("View Column Details"):
            col_info = pd.DataFrame({
                'Column': df.columns,
                'Type': df.dtypes.astype(str),
                'Non-Null': df.count().values,
                'Null %': (df.isna().sum() / len(df) * 100).round(1).values,
            })
            st.dataframe(col_info, use_container_width=True, hide_index=True)

        # Next step button
        st.markdown("---")
        col1, col2, col3 = st.columns([2, 1, 1])
        with col3:
            if st.button("Next: Explore Data →", use_container_width=True):
                st.switch_page("pages/02_Data_Exploration.py")


if __name__ == "__main__":
    main()
