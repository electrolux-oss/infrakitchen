# Batch Operations

## Overview

Batch operations let you run the same action across multiple resources or executors at once.
They are created by selecting entities and choosing a bulk action.

!!! warning "Available only for Super Admins"
    Batch operations are currently restricted to Super Admin users only.

## Actions

Batch operations currently support:

- Plan (dry run)
- Execute

## Error Handling

If some entities cannot be processed, the response includes `error_entity_ids` with
the entity ID and the reason (for example, an invalid state for the requested action).
