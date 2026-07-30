# Version Lifecycle State

**Version Lifecycle State** describes where a **Source Code Version** sits in its life-from an early preview, through active use, to eventual deprecation and archival. It gives platform teams a clear signal about which versions are safe to use for new resources and which should be avoided.

Each Source Code Version carries a single lifecycle state. The state is visualized throughout the UI as a colored chip, helping developers pick the right version at a glance when creating or updating resources.

---

## 🔖 Lifecycle States

InfraKitchen supports the following lifecycle states:

| State          | Meaning                                                           | Chip Color | Typical Use                                              |
| :------------- | :---------------------------------------------------------------- | :--------- | :------------------------------------------------------- |
| **Unknown**    | Default state; no explicit lifecycle has been assigned            | Default    | Newly created versions before curation                   |
| **Preview**    | Early or experimental version, not yet recommended for production | Info       | Testing new implementations before promoting them        |
| **Active**     | Recommended, production-ready version                             | Success    | The version developers should use for new resources      |
| **Deprecated** | Still usable, but discouraged; a newer version is preferred       | Warning    | Signaling a planned migration away from this version     |
| **Archived**   | No longer in use; typically set when a version is disabled        | Error      | Retiring a version from active selection                 |

!!! info "Default State"
    Every Source Code Version starts in the **Unknown** state. Assign a meaningful lifecycle state as part of curating a template's versions.

---

## 🔄 State Transitions

Lifecycle state can be set explicitly when updating a Source Code Version, and it is also adjusted automatically by certain actions:

- **Disabling a version** sets its lifecycle state to **Archived**.
- **Enabling a previously disabled version** resets its lifecycle state to **Unknown**.
- All other transitions (**Preview**, **Active**, **Deprecated**) are set explicitly by editing the version.

---

## 🧩 Breaking Changes

Alongside the lifecycle state, a version can carry an optional **Breaking Changes** note. When present, the UI displays a warning indicator next to the lifecycle chip with the details in a tooltip.

Use this field to communicate incompatibilities-such as changed variables, removed outputs, or required migration steps-so developers understand the impact before adopting the version.

---

## ✏️ Setting the Lifecycle State

The lifecycle state is a property of a Source Code Version and can be changed when editing that version.

**Steps:**

1. Navigate to the **Template** and open its **Source Code Versions**
2. Select the version you want to curate
3. Update the **Lifecycle State** to the desired value
4. Optionally add a **Breaking Changes** note
5. Save your changes

!!! note "Automatic Overrides"
    Disabling or enabling a version will override the lifecycle state as described in [State Transitions](#-state-transitions).

---

## 🔗 Related Concepts

- [Templates](overview.md) - the organizational structure that owns Source Code Versions
- [Resources](../resources/overview.md) - concrete instances created from a template using a specific version
