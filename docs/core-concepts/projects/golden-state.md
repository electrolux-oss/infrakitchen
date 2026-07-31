# Golden State

Golden State is InfraKitchen's compliance view for resources against the currently recommended template version or active version set.

It answers one question:

"Is each resource using the version of its template that the platform currently considers the standard?"

You can see Golden State:

- On the dashboard as a cross-project summary
- On each project page as a project-specific report

---

## What Golden State Compares

For each non-abstract resource, InfraKitchen looks up:

- The resource's current Source Code Version
- The template that resource belongs to
- All `Active` Source Code Versions for that template
- The highest-index `Active` Source Code Version for that template

Any active version counts as compliant for scoring.

The highest-index active version is still treated as the golden reference for deciding whether non-active resources are behind the recommended version.

If a template has no `Active` version, the resource is marked as `no_golden` and is excluded from the score calculation.

---

## Statuses

Each resource is classified into one of these states:

| Status | Meaning | Counts against score? |
| :----- | :------ | :-------------------- |
| `compliant` | The resource uses any active version of its template | No |
| `update_available` | A newer golden version exists and the resource can move forward without a breaking-change flag | Yes |
| `deprecated` | The resource uses a version whose lifecycle state is `Deprecated` | Yes |
| `critical` | The resource has no version, uses an `Archived` version, or the golden version has breaking changes and the resource is still behind | Yes |
| `no_golden` | The template has no active version to compare against | No, excluded from scoring |

---

## How The Score Is Calculated

Golden State score is a percentage of compliant resources among comparable resources.

Formula:

```text
score = compliant / comparable * 100
```

Where:

- `compliant` = resources classified as `compliant`
- `comparable` = all resources except `no_golden`

More explicitly:

```text
comparable = total - no_golden
score = compliant / (total - no_golden) * 100
```

If there are no comparable resources, the score is `100.0`.

---

## What You Need To Reach 100

To reach a Golden State score of `100`, every comparable resource must be `compliant`.

In practice, that means:

1. Make sure each template has the correct active Source Code Version or set of active versions
2. Update every resource to one of that template's active versions
3. Avoid leaving resources on `Deprecated` versions
4. Avoid leaving resources on `Archived` versions
5. Make sure resources are not missing their Source Code Version assignment
6. When an active version has breaking changes, complete the migration instead of leaving resources behind

Important detail:

- Resources in `no_golden` do not reduce the score
- But they also do not count as compliant, so they still indicate missing template curation

---

## Recommended Workflow For Platform Teams

Use Golden State as an operational loop:

1. Curate template versions
2. Mark the recommended version as `Active`
3. Add a breaking-changes note when adoption requires manual migration work
4. Review the dashboard or project Golden State report
5. Migrate resources in `update_available`, `deprecated`, and `critical`
6. Repeat whenever a new template version becomes the standard

---

## Related Concepts

- [Projects](overview.md)
- [Resources](../resources/overview.md)
- [Templates](../templates/overview.md)
- [Version Lifecycle State](../templates/version-lifecycle-state.md)
