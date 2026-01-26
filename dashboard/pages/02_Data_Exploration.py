"""Data Exploration Page - Visualize and understand the data."""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, CHART_COLORS
from dashboard.data import detect_column_types, compute_correlation_matrix, detect_outliers

# Page config
st.set_page_config(page_title="Data Exploration - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Data Exploration")
    st.caption("Step 2 of 8")

    # Check if data is loaded
    if not get_state('data_loaded'):
        st.warning("Please upload data first.")
        if st.button("Go to Data Upload"):
            st.switch_page("pages/01_Data_Upload.py")
        return

    df = get_state('data')
    col_types = detect_column_types(df)

    # Summary statistics
    st.markdown("### Summary Statistics")

    stat_cols = st.columns(4)
    with stat_cols[0]:
        st.metric("Total Rows", f"{len(df):,}")
    with stat_cols[1]:
        st.metric("Numeric Columns", len(col_types['numeric']))
    with stat_cols[2]:
        st.metric("Categorical Columns", len(col_types['categorical']))
    with stat_cols[3]:
        missing_pct = df.isna().sum().sum() / (len(df) * len(df.columns)) * 100
        st.metric("Missing Data", f"{missing_pct:.1f}%")

    st.markdown("---")

    # Time series visualization
    st.markdown("### Time Series Visualization")

    date_col = col_types['date'][0] if col_types['date'] else None
    numeric_cols = col_types['numeric']

    if date_col and numeric_cols:
        selected_cols = st.multiselect(
            "Select columns to plot",
            numeric_cols,
            default=numeric_cols[:3] if len(numeric_cols) >= 3 else numeric_cols,
        )

        if selected_cols:
            # Prepare data
            plot_df = df.copy()
            plot_df[date_col] = pd.to_datetime(plot_df[date_col])
            plot_df = plot_df.sort_values(date_col)

            # Create figure
            fig = go.Figure()

            colors = list(CHART_COLORS.values())
            for i, col in enumerate(selected_cols):
                fig.add_trace(go.Scatter(
                    x=plot_df[date_col],
                    y=plot_df[col],
                    name=col,
                    line=dict(color=colors[i % len(colors)]),
                ))

            fig.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                xaxis_title="Date",
                yaxis_title="Value",
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
                height=400,
            )

            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No date column detected. Time series visualization unavailable.")

    st.markdown("---")

    # Correlation matrix
    st.markdown("### Correlation Matrix")

    if len(numeric_cols) >= 2:
        corr_cols = st.multiselect(
            "Select columns for correlation",
            numeric_cols,
            default=numeric_cols[:8] if len(numeric_cols) >= 8 else numeric_cols,
            key="corr_cols",
        )

        if len(corr_cols) >= 2:
            corr_matrix = compute_correlation_matrix(df, corr_cols)

            fig = px.imshow(
                corr_matrix,
                text_auto='.2f',
                color_continuous_scale='RdBu_r',
                zmin=-1,
                zmax=1,
            )

            fig.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                height=500,
            )

            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Need at least 2 numeric columns for correlation analysis.")

    st.markdown("---")

    # Distribution analysis
    st.markdown("### Distribution Analysis")

    col1, col2 = st.columns(2)

    with col1:
        if numeric_cols:
            dist_col = st.selectbox("Select column", numeric_cols)

            fig = px.histogram(
                df,
                x=dist_col,
                nbins=30,
                color_discrete_sequence=[CHART_COLORS['primary']],
            )

            fig.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                showlegend=False,
                height=300,
            )

            st.plotly_chart(fig, use_container_width=True)

            # Basic stats
            st.markdown(f"""
            **Statistics for {dist_col}:**
            - Mean: {df[dist_col].mean():,.2f}
            - Median: {df[dist_col].median():,.2f}
            - Std Dev: {df[dist_col].std():,.2f}
            - Min: {df[dist_col].min():,.2f}
            - Max: {df[dist_col].max():,.2f}
            """)

    with col2:
        if numeric_cols:
            # Outlier detection
            st.markdown("**Outlier Detection**")

            outlier_col = st.selectbox("Select column for outlier detection", numeric_cols, key="outlier_col")

            outliers = detect_outliers(df, outlier_col, method="iqr", threshold=1.5)
            n_outliers = outliers.sum()

            if n_outliers > 0:
                st.warning(f"Found **{n_outliers}** potential outliers in {outlier_col}")

                # Box plot
                fig = px.box(
                    df,
                    y=outlier_col,
                    color_discrete_sequence=[CHART_COLORS['primary']],
                )

                fig.update_layout(
                    template="plotly_dark",
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    height=300,
                )

                st.plotly_chart(fig, use_container_width=True)
            else:
                st.success(f"No significant outliers detected in {outlier_col}")

    st.markdown("---")

    # Missing data visualization
    st.markdown("### Missing Data Analysis")

    missing = df.isna().sum()
    missing_pct = (missing / len(df) * 100).round(2)
    missing_df = pd.DataFrame({
        'Column': missing.index,
        'Missing Count': missing.values,
        'Missing %': missing_pct.values,
    }).sort_values('Missing Count', ascending=False)

    if missing.sum() > 0:
        fig = px.bar(
            missing_df[missing_df['Missing Count'] > 0],
            x='Column',
            y='Missing %',
            color_discrete_sequence=[CHART_COLORS['warning']],
        )

        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            height=300,
        )

        st.plotly_chart(fig, use_container_width=True)
    else:
        st.success("No missing values in the dataset!")

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/01_Data_Upload.py")

    with col3:
        if st.button("Next: Column Mapping →", use_container_width=True):
            st.switch_page("pages/03_Column_Mapping.py")


if __name__ == "__main__":
    main()
