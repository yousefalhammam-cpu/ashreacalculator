# Access policy

The platform is open without subscription. Configure ACCESS_POLICY in modules/plan.js:
- mode: 'open' enables known features for guests and signed-in users.
- features: { exportPDF: false } disables an individual feature in either mode.
- mode: 'plans' restores the previous guest/signed-in feature map. This is not payment verification.

Unknown feature names are denied. Do not use DOM badges or local flags as paid-access security. Future monetization must enforce entitlements server-side.

Authentication and Firestore security rules remain required for private cloud data. Open access does not grant access to another user's projects. Local project saving and exports do not require a subscription.
