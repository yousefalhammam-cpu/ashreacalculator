# Duct and Filter Synchronization

## Scope
- Fan type is visible beside the dimension and filter controls, not only under fan settings.
- The fan/filter selection persists in browser storage and project snapshots.
- 100 mm dimensions now survive reload (the previous load guard rejected values below 150 mm).
- getDuctFilterReviewState is the shared derived review source. Catalogue equipment CFM remains unchanged.
- Copilot snapshots use estimated post-filter CFM only when fan inputs are valid, and mark the metric as estimated. Missing fan inputs display an unavailable airflow score, not a reassuring original-equipment score.
- ESP inputs use computed straight-duct loss when manual dimensions and both duct runs are available; bends and other existing adders remain. Added filter loss is added once to baseline filter resistance.
- Technical report explicitly displays catalogue CFM and estimated filtered CFM separately.
- Airflow and pressure metrics show raw CFM/Pa as well as scores; score thresholds mean that a raw-value change need not change the score.

## Engineering Limitations
Filter airflow estimate retains the fixed-speed linear fan/quadratic filter approximation. Changing dimensions changes calculated velocity and pressure, but does not by itself establish a new fan operating point. This implementation does not fabricate a CFM change from duct dimensions without an actual fan/system curve. No catalogue snapshot or commercial equipment specification is overwritten.

## Validation and Deployment
Regression tests cover shared filter values, health score propagation, incomplete fan data, dimension pressure response and preservation of catalogue airflow. Browser/network tests and GitHub push may require the host approval quota to be available. Do not label these as passed or deployed until actually completed.
