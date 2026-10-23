# Tabro HealthKit Component

The web build cannot register a native iOS plugin. This source is ready for integration in the signed Capacitor iOS target, but has not been built or tested on an iPhone in this workspace.

1. Add an iOS platform with Capacitor in the mobile build workspace.
2. Add `TabroHealthPlugin.swift` to the app target. Register `TabroHealthPlugin()` in the custom `CAPBridgeViewController.capacitorDidLoad()` using `bridge?.registerPluginInstance(...)`.
3. Enable HealthKit for the app identifier and provisioning profile.
4. Set `NSHealthShareUsageDescription` to a localized explanation of sleep and step-count reading. The component requests read access only, and never writes HealthKit data.
5. Build, sign and install on an iPhone. The health panel enables its native connection button only when the installed plugin is available.

Use the production Tabro frontend in the mobile configuration. Do not ship the current development preview URL from `capacitor.config.ts` as a production app.

The component queries 30 local calendar days, lets HealthKit aggregate step counts across sources, merges overlapping asleep stages, and keeps absent data null rather than inventing zero values. Permission-dialog completion is not treated as proof of read permission. Native data is stored on the device only by the frontend panel.

Verification required on device: refusal, limited access, revocation, timezone changes, multiple watches, overlapping sleep stages and reinstall. Android Health Connect and direct vendor-watch connections are not implemented by this iOS source.

Official references:
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- https://capacitorjs.com/docs/ios/custom-code
