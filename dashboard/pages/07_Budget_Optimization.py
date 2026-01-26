"""Budget Optimization Page - Optimize marketing budget allocation."""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, set_state, CHART_COLORS
from dashboard.core.optimization import optimize_budget_marginal_roi, calculate_expected_lift

# Page config
st.set_page_config(page_title="Budget Optimization - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Budget Optimization")
    st.caption("Step 7 of 8")

    # Check prerequisites
    if not get_state('model_trained'):
        st.warning("Please train a model first.")
        if st.button("Go to Model Training"):
            st.switch_page("pages/05_Model_Training.py")
        return

    elasticities = get_state('elasticities')
    if not elasticities:
        st.warning("Elasticity estimates not available. Please view results first.")
        if st.button("Go to Results"):
            st.switch_page("pages/06_Results.py")
        return

    df = get_state('data')
    media_cols = get_state('media_columns')
    target_col = get_state('target_column')

    # Current spend
    current_spend = {ch: float(df[ch].sum()) for ch in media_cols}
    total_current = sum(current_spend.values())
    current_sales = float(df[target_col].sum())

    st.markdown("---")

    # Layout: Left (current allocation & constraints) | Right (optimization)
    left_col, right_col = st.columns([2, 1])

    with left_col:
        # Current Budget Allocation
        st.markdown("### Current Budget Allocation")

        stat_col1, stat_col2 = st.columns([1, 2])

        with stat_col1:
            st.metric("Total Budget", f"${total_current/1e6:.2f}M")

        # Pie chart
        colors = [CHART_COLORS['chart_1'], CHART_COLORS['chart_2'],
                  CHART_COLORS['chart_3'], CHART_COLORS['chart_4'],
                  CHART_COLORS['chart_5'], CHART_COLORS['chart_6']]

        fig = go.Figure(data=[go.Pie(
            labels=media_cols,
            values=[current_spend[ch] for ch in media_cols],
            hole=0.4,
            marker_colors=colors[:len(media_cols)],
        )])

        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor='rgba(0,0,0,0)',
            showlegend=True,
            height=250,
            margin=dict(t=0, b=0, l=0, r=0),
        )

        st.plotly_chart(fig, use_container_width=True)

        # Channel breakdown
        for i, ch in enumerate(media_cols):
            pct = current_spend[ch] / total_current * 100
            st.markdown(f"**{ch}**: ${current_spend[ch]/1e6:.2f}M ({pct:.0f}%)")

        st.markdown("---")

        # Constraints
        st.markdown("### Channel Constraints")

        col1, col2 = st.columns([3, 1])
        with col2:
            if st.button("Reset"):
                st.rerun()

        constraints = {}
        for ch in media_cols:
            st.markdown(f"**{ch}**")
            col1, col2 = st.columns(2)
            with col1:
                min_pct = st.slider(
                    f"Min {ch}",
                    min_value=0,
                    max_value=50,
                    value=10,
                    key=f"min_{ch}",
                    label_visibility="collapsed",
                )
            with col2:
                max_pct = st.slider(
                    f"Max {ch}",
                    min_value=min_pct,
                    max_value=100,
                    value=50,
                    key=f"max_{ch}",
                    label_visibility="collapsed",
                )
            st.caption(f"{min_pct}% - {max_pct}%")
            constraints[ch] = (min_pct / 100, max_pct / 100)

    with right_col:
        # Optimization controls
        st.markdown("### Run Optimization")

        st.markdown("**Total Budget**")
        budget_input = st.number_input(
            "Budget",
            min_value=100000,
            max_value=100000000,
            value=int(total_current),
            step=100000,
            format="%d",
            label_visibility="collapsed",
        )

        col1, col2 = st.columns(2)
        with col1:
            if st.button("-10%", use_container_width=True):
                st.session_state['budget_input'] = int(total_current * 0.9)
                st.rerun()
        with col2:
            if st.button("+10%", use_container_width=True):
                st.session_state['budget_input'] = int(total_current * 1.1)
                st.rerun()

        st.markdown("")

        if st.button("⚡ Optimize Budget", use_container_width=True, type="primary"):
            with st.spinner("Optimizing..."):
                optimal_spend = optimize_budget_marginal_roi(
                    total_budget=budget_input,
                    channels=media_cols,
                    elasticities=elasticities,
                    current_spend=current_spend,
                    avg_sales=current_sales / len(df),
                    constraints=constraints,
                )

                lift_results = calculate_expected_lift(
                    current_spend=current_spend,
                    optimal_spend=optimal_spend,
                    elasticities=elasticities,
                    current_sales=current_sales,
                )

                set_state('optimization_results', {
                    'optimal_spend': optimal_spend,
                    'lift_results': lift_results,
                    'constraints': constraints,
                })

                st.success("Optimization complete!")

        st.markdown("---")

        # Results
        st.markdown("### Optimization Results")

        opt_results = get_state('optimization_results')

        if opt_results:
            lift = opt_results['lift_results']
            optimal_spend = opt_results['optimal_spend']

            # KPI card
            st.markdown(f"""
            <div style="background-color: #065F46; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <div style="color: #10B981; font-size: 20px; font-weight: 600;">
                    +{lift['lift_pct']:.1f}% Expected Lift
                </div>
                <div style="color: #94A3B8; font-size: 12px;">
                    Projected revenue increase
                </div>
            </div>
            """, unsafe_allow_html=True)

            # Changes
            st.markdown("**Recommended Changes**")

            for ch in media_cols:
                curr = current_spend[ch]
                opt = optimal_spend[ch]
                change_pct = (opt - curr) / curr * 100 if curr > 0 else 0

                color = CHART_COLORS['success'] if change_pct > 0 else CHART_COLORS['error']
                sign = "+" if change_pct > 0 else ""

                col1, col2 = st.columns([2, 1])
                with col1:
                    st.markdown(f"**{ch}**")
                with col2:
                    st.markdown(f"<span style='color: {color}; font-weight: 600;'>{sign}{change_pct:.0f}%</span>",
                                unsafe_allow_html=True)

            st.markdown("---")

            if st.button("📥 Export Optimized Plan", use_container_width=True):
                # Create export dataframe
                export_df = pd.DataFrame([
                    {
                        'Channel': ch,
                        'Current Spend': current_spend[ch],
                        'Optimal Spend': optimal_spend[ch],
                        'Change %': (optimal_spend[ch] - current_spend[ch]) / current_spend[ch] * 100
                    }
                    for ch in media_cols
                ])
                st.download_button(
                    label="Download CSV",
                    data=export_df.to_csv(index=False),
                    file_name="optimized_budget.csv",
                    mime="text/csv",
                )
        else:
            st.info("Run optimization to see results")

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/06_Results.py")

    with col3:
        if st.button("Next: Scenario Planning →", use_container_width=True):
            st.switch_page("pages/08_Scenario_Planning.py")


if __name__ == "__main__":
    main()
