# Responsive workspace

The workspace adapts to available width, not a browser or device name. Below
1024 CSS pixels, `Personal` renders `MobileWorkspaceLayout`. At 1024 and above,
the existing seven desktop layouts remain available. The stored desktop layout
is never rewritten by breakpoint detection.

## Navigation and Content

- The compact header shows the current screen and the existing notification
  bell. Account actions remain available in the menu.
- Bottom shortcuts use visible dashboard, personal tasks, planner and finance
  tabs only. All other visible tabs, including work, shared and custom boards,
  remain in the searchable menu. Hidden tabs are not reintroduced.
- The menu is a focus-trapped Radix Sheet. It initially focuses its title rather
  than opening the phone keyboard. The user can search explicitly.
- Main content scrolls independently of the header and bottom navigation.
  Nested large tables keep horizontal scrolling, rather than hiding columns.
- Tasks default to a list in compact mode. `mobileViewMode` is stored separately
  inside each existing `dashboard-display-prefs` entry. Desktop `viewMode` and
  the theme are preserved. Existing preferences migrate without a new key.
- New tasks on compact screens open the existing full details editor; desktop
  inline editing is unchanged. Advanced tools and all five task views remain.
- Compact planner defaults to day view. All other views remain selectable.
  Additional quick presets, exports and tools can be expanded without losing
  the calendar actions.
- Personal workspace screens are lazy-loaded behind the existing Suspense and
  panel error boundary. This reduces the base entry bundle, but is not a claim
  about end-to-end network or physical-device performance.

## Viewport, Overlays and Touch

The viewport meta tag allows pinch zoom and includes `viewport-fit=cover`.
`visualViewport` resize/scroll and focus events update the compact workspace
height. Zoomed viewports are deliberately not used to resize the layout, so
the user can zoom normally. Event listeners and CSS variables are cleaned up
when leaving the compact layout.

Safe-area insets protect the header, menu and bottom navigation. Dialogs and
popovers are bounded and scrollable; the existing desktop sizing is retained
outside the compact breakpoint. Shared buttons have 44 CSS pixel minimum touch
targets in compact mode. Forms keep 16px input text on phones to avoid unwanted
focus zoom. Floating accessibility, AI and media controls are kept above the
navigation and below modal dialogs.

## Verification

- Pure regression tests: `tests/responsiveWorkspace.test.mjs` covers shortcut
  visibility, search, six-language copy, preference separation, zoom permission
  and viewport cleanup contracts.
- Development-only fixture: `/tests/fixtures/responsiveWorkspace.html`. It uses
  fake local data and the `responsive-workspace-qa-only` preference namespace;
  it performs no account, bank or AI requests.
- Matrix: 320x568, 390x844, 430x932, 844x390, 820x1180, 1440x900, RTL and LTR.
  Check every menu item, closing/focus behavior, long form scrolling and internal
  wide-table scroll. Resizing must not overwrite desktop view preferences.
- Browser emulation cannot certify physical iPhone keyboard, standalone-PWA or
  notch behavior. Those still need a real device check. This is a responsive
  website update, not a signed native iOS/Android app release.

The cloud sandbox QA pass checked Chromium and WebKit at all six matrix sizes,
including menu search/focus, shared/custom board navigation, internal table
scroll, long dialogs, and separate desktop/mobile display choices. The public
home, sign-in, terms and install routes and the nutrition fixture were also
checked. A desktop long-dialog overflow was found and fixed with a
zero-specificity maximum-height fallback. Real signed-in workspace screens
were blocked by the owner's PIN gate, which was not bypassed. No real account
data was edited during these checks. Keyboard resizing was simulated only.

No bank credentials, financial synchronization, health data, database schemas,
avatar abilities or native blocking/HealthKit integration are changed here.
