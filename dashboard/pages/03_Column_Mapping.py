"""Column Mapping Page - Map data columns to model variables."""

import streamlit as st
import pandas as pd
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, set_state, update_state
from dashboard.data import detect_column_types, validate_data

# Page config
st.set_page_config(page_title="Column Mapping - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Column Mapping")
    st.caption("Step 3 of 8")

    # Check if data is loaded
    if not get_state('data_loaded'):
        st.warning("Please upload data first.")
        if st.button("Go to Data Upload"):
            st.switch_page("pages/01_Data_Upload.py")
        return

    df = get_state('data')
    col_types = detect_column_types(df)

    st.markdown("""
    Map your data columns to the model variables. The model needs to know which
    columns represent dates, your target KPI, and media spend.
    """)

    st.markdown("---")

    # Date column
    st.markdown("### 📅 Date Column")
    st.caption("Select the column containing your date/time information")

    date_options = col_types['date'] + [c for c in df.columns if c not in col_types['date']]
    default_date = col_types['date'][0] if col_types['date'] else None

    date_column = st.selectbox(
        "Date column",
        options=date_options,
        index=date_options.index(default_date) if default_date else 0,
        key="date_col_select",
    )

    if date_column:
        set_state('date_column', date_column)

        # Show date range
        try:
            dates = pd.to_datetime(df[date_column])
            st.success(f"Date range: **{dates.min().strftime('%Y-%m-%d')}** to **{dates.max().strftime('%Y-%m-%d')}** ({len(dates)} periods)")
        except Exception:
            st.warning("Could not parse dates. Please verify the column format.")

    st.markdown("---")

    # Target column
    st.markdown("### 🎯 Target/KPI Column")
    st.caption("Select the column containing your sales, revenue, or conversion data")

    numeric_cols = col_types['numeric']
    default_target = col_types['potential_target'][0] if col_types['potential_target'] else None

    target_column = st.selectbox(
        "Target column",
        options=numeric_cols,
        index=numeric_cols.index(default_target) if default_target and default_target in numeric_cols else 0,
        key="target_col_select",
    )

    if target_column:
        set_state('target_column', target_column)

        # Show basic stats
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Mean", f"{df[target_column].mean():,.0f}")
        with col2:
            st.metric("Median", f"{df[target_column].median():,.0f}")
        with col3:
            st.metric("Min", f"{df[target_column].min():,.0f}")
        with col4:
            st.metric("Max", f"{df[target_column].max():,.0f}")

    st.markdown("---")

    # Media spend columns
    st.markdown("### 📺 Media Spend Columns")
    st.caption("Select all columns containing media/advertising spend data")

    # Exclude date and target from options
    media_options = [c for c in numeric_cols if c != target_column]
    default_media = [c for c in col_types['potential_media'] if c in media_options]

    media_columns = st.multiselect(
        "Media spend columns",
        options=media_options,
        default=default_media,
        key="media_cols_select",
    )

    if media_columns:
        set_state('media_columns', media_columns)

        st.success(f"Selected **{len(media_columns)}** media channels")

        # Show summary table
        media_summary = df[media_columns].describe().T[['mean', 'std', 'min', 'max']]
        media_summary.columns = ['Mean', 'Std Dev', 'Min', 'Max']
        media_summary = media_summary.round(0).astype(int)
        st.dataframe(media_summary, use_container_width=True)

    st.markdown("---")

    # Control variables (optional)
    st.markdown("### ⚙️ Control Variables (Optional)")
    st.caption("Select any non-media variables that might affect your KPI (e.g., pricing, promotions, macro factors)")

    control_options = [c for c in media_options if c not in media_columns]

    control_columns = st.multiselect(
        "Control variables",
        options=control_options,
        default=[],
        key="control_cols_select",
    )

    set_state('control_columns', control_columns)

    st.markdown("---")

    # Segment filter (optional)
    st.markdown("### 🏷️ Segment Filter (Optional)")
    st.caption("Filter data by a specific segment or geography")

    categorical_cols = col_types['categorical']

    if categorical_cols:
        use_segment = st.checkbox("Filter by segment")

        if use_segment:
            segment_column = st.selectbox(
                "Segment column",
                options=categorical_cols,
            )

            if segment_column:
                segment_values = df[segment_column].unique().tolist()
                segment_value = st.selectbox(
                    "Select segment value",
                    options=segment_values,
                )

                set_state('segment_column', segment_column)
                set_state('segment_value', segment_value)

                filtered_count = len(df[df[segment_column] == segment_value])
                st.info(f"Filtering to **{filtered_count}** rows where {segment_column} = {segment_value}")
        else:
            set_state('segment_column', None)
            set_state('segment_value', None)
    else:
        st.info("No categorical columns available for segmentation.")

    st.markdown("---")

    # Validation
    st.markdown("### ✅ Validation")

    if date_column and target_column and media_columns:
        warnings = validate_data(df, date_column, target_column, media_columns)

        if warnings:
            st.warning("**Validation Warnings:**")
            for w in warnings:
                st.markdown(f"- {w}")
        else:
            st.success("Data validation passed! Ready to proceed.")

        # Summary
        st.markdown("---")
        st.markdown("### Configuration Summary")

        col1, col2 = st.columns(2)

        with col1:
            st.markdown(f"""
            **Selected Columns:**
            - Date: `{date_column}`
            - Target: `{target_column}`
            - Media Channels: {len(media_columns)}
            - Controls: {len(control_columns)}
            """)

        with col2:
            segment_col = get_state('segment_column')
            segment_val = get_state('segment_value')

            st.markdown(f"""
            **Data Summary:**
            - Rows: {len(df):,}
            - Date Range: {pd.to_datetime(df[date_column]).min().strftime('%Y-%m-%d')} to {pd.to_datetime(df[date_column]).max().strftime('%Y-%m-%d')}
            - Segment Filter: {f'{segment_col}={segment_val}' if segment_col else 'None'}
            """)
    else:
        st.info("Please complete the column mapping above to proceed.")

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/02_Data_Exploration.py")

    with col3:
        can_proceed = date_column and target_column and media_columns
        if st.button("Next: Configure Model →", use_container_width=True, disabled=not can_proceed):
            st.switch_page("pages/04_Model_Config.py")


if __name__ == "__main__":
    main()
