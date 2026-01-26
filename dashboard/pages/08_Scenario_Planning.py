"""Scenario Planning Page - Test different budget scenarios."""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, set_state, CHART_COLORS
from dashboard.core.optimization import create_scenario, compare_scenarios, calculate_expected_lift

# Page config
st.set_page_config(page_title="Scenario Planning - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Scenario Planning")
    st.caption("Step 8 of 8")

    # Check prerequisites
    if not get_state('model_trained'):
        st.warning("Please train a model first.")
        if st.button("Go to Model Training"):
            st.switch_page("pages/05_Model_Training.py")
        return

    elasticities = get_state('elasticities')
    if not elasticities:
        st.warning("Elasticity estimates not available.")
        if st.button("Go to Results"):
            st.switch_page("pages/06_Results.py")
        return

    df = get_state('data')
    media_cols = get_state('media_columns')
    target_col = get_state('target_column')

    # Current values
    current_spend = {ch: float(df[ch].sum()) for ch in media_cols}
    total_current = sum(current_spend.values())
    current_sales = float(df[target_col].sum())
    avg_sales = current_sales / len(df)

    # Initialize scenarios if not exist
    if 'scenarios' not in st.session_state or not st.session_state['scenarios']:
        st.session_state['scenarios'] = [{
            'name': 'Current',
            'spend_allocation': current_spend.copy(),
            'total_spend': total_current,
            'projected_sales': current_sales,
        }]

    st.markdown("---")

    # Layout
    left_col, right_col = st.columns([2, 1])

    with left_col:
        st.markdown("### Adjust Channel Spend")
        st.caption("Use the sliders to create a spending scenario")

        scenario_spend = {}
        total_scenario = 0

        for i, ch in enumerate(media_cols):
            current = current_spend[ch]
            max_val = current * 3  # Allow up to 3x current

            col1, col2, col3 = st.columns([1, 3, 1])

            with col1:
                st.markdown(f"**{ch}**")

            with col2:
                value = st.slider(
                    f"{ch} spend",
                    min_value=0,
                    max_value=int(max_val),
                    value=int(current),
                    step=int(max_val / 100),
                    key=f"scenario_{ch}",
                    label_visibility="collapsed",
                )
                scenario_spend[ch] = value
                total_scenario += value

            with col3:
                change = (value - current) / current * 100 if current > 0 else 0
                color = CHART_COLORS['success'] if change > 0 else CHART_COLORS['error'] if change < 0 else '#94A3B8'
                sign = "+" if change > 0 else ""
                st.markdown(f"<span style='color: {color};'>{sign}{change:.0f}%</span>", unsafe_allow_html=True)

        st.markdown("---")

        # Projected results
        st.markdown("### Projected Sales")

        # Calculate lift for current scenario
        lift_results = calculate_expected_lift(
            current_spend=current_spend,
            optimal_spend=scenario_spend,
            elasticities=elasticities,
            current_sales=current_sales,
        )

        projected_sales = lift_results['expected_sales']
        lift_pct = lift_results['lift_pct']

        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric(
                "Total Spend",
                f"${total_scenario/1e6:.2f}M",
                delta=f"{(total_scenario - total_current) / total_current * 100:+.1f}%",
            )

        with col2:
            st.metric(
                "Projected Sales",
                f"${projected_sales/1e6:.2f}M",
                delta=f"{lift_pct:+.1f}%",
            )

        with col3:
            roi = projected_sales / total_scenario if total_scenario > 0 else 0
            current_roi = current_sales / total_current if total_current > 0 else 0
            st.metric(
                "Overall ROI",
                f"{roi:.2f}x",
                delta=f"{(roi - current_roi) / current_roi * 100:+.1f}%" if current_roi > 0 else None,
            )

        # Confidence band visualization
        fig = go.Figure()

        # Confidence bands
        weeks = list(range(1, 13))
        baseline = [projected_sales / 52] * 12
        upper = [b * 1.1 for b in baseline]
        lower = [b * 0.9 for b in baseline]

        fig.add_trace(go.Scatter(
            x=weeks + weeks[::-1],
            y=upper + lower[::-1],
            fill='toself',
            fillcolor='rgba(79, 70, 229, 0.2)',
            line=dict(color='rgba(255,255,255,0)'),
            name='95% CI',
        ))

        fig.add_trace(go.Scatter(
            x=weeks,
            y=baseline,
            mode='lines',
            line=dict(color=CHART_COLORS['primary'], width=2),
            name='Projected',
        ))

        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            height=250,
            xaxis_title="Week",
            yaxis_title="Projected Sales",
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
        )

        st.plotly_chart(fig, use_container_width=True)

    with right_col:
        st.markdown("### Saved Scenarios")

        # Save current scenario
        scenario_name = st.text_input("Scenario name", value="Scenario " + str(len(st.session_state['scenarios'])))

        if st.button("💾 Save Scenario", use_container_width=True):
            new_scenario = {
                'name': scenario_name,
                'spend_allocation': scenario_spend.copy(),
                'total_spend': total_scenario,
                'projected_sales': projected_sales,
            }
            st.session_state['scenarios'].append(new_scenario)
            st.success(f"Saved '{scenario_name}'")

        st.markdown("---")

        # List saved scenarios
        scenarios = st.session_state['scenarios']

        for i, scenario in enumerate(scenarios):
            with st.expander(f"📊 {scenario['name']}", expanded=False):
                st.markdown(f"**Total Spend:** ${scenario['total_spend']/1e6:.2f}M")
                st.markdown(f"**Projected Sales:** ${scenario['projected_sales']/1e6:.2f}M")

                if scenario['name'] != 'Current' and st.button(f"🗑️ Delete", key=f"del_{i}"):
                    st.session_state['scenarios'].pop(i)
                    st.rerun()

        st.markdown("---")

        # Comparison chart
        if len(scenarios) > 1:
            st.markdown("### Scenario Comparison")

            comparison_df = pd.DataFrame([
                {'Scenario': s['name'], 'Sales': s['projected_sales'] / 1e6}
                for s in scenarios
            ])

            fig = px.bar(
                comparison_df,
                x='Scenario',
                y='Sales',
                color_discrete_sequence=[CHART_COLORS['primary']],
            )

            fig.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                height=200,
                yaxis_title="Sales ($M)",
                showlegend=False,
            )

            st.plotly_chart(fig, use_container_width=True)

        # Export
        st.markdown("---")

        if st.button("📥 Export Report", use_container_width=True):
            export_data = []
            for scenario in scenarios:
                row = {'Scenario': scenario['name'], 'Total Spend': scenario['total_spend'],
                       'Projected Sales': scenario['projected_sales']}
                row.update(scenario['spend_allocation'])
                export_data.append(row)

            export_df = pd.DataFrame(export_data)
            st.download_button(
                label="Download CSV",
                data=export_df.to_csv(index=False),
                file_name="scenario_comparison.csv",
                mime="text/csv",
            )

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/07_Budget_Optimization.py")

    with col3:
        if st.button("🏠 Back to Home", use_container_width=True):
            st.switch_page("app.py")


if __name__ == "__main__":
    main()
