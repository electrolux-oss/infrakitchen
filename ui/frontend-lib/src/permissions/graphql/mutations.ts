export interface RoleCreateMutationInput {
  userId: string;
  role: string;
}

export const CREATE_ROLE_MUTATION = `
  mutation CreateRole($input: RoleCreateInput!) {
    createRole(input: $input) {
      id
      ptype
      v0
      v1
    }
  }
`;

export interface AssignUserToRoleMutationInput {
  roleId: string;
  userId: string;
}

export const ASSIGN_USER_TO_ROLE_MUTATION = `
  mutation AssignUserToRole($roleId: String!, $userId: UUID!) {
    assignUserToRole(roleId: $roleId, userId: $userId) {
      id
      ptype
      v0
      v1
    }
  }
`;

export interface ApiPolicyCreateMutationInput {
  role: string;
  api: string;
  action: string;
}

export const CREATE_API_POLICY_MUTATION = `
  mutation CreateApiPolicy($input: ApiPolicyCreateInput!) {
    createApiPolicy(input: $input) {
      id
      ptype
      v0
      v1
      v2
    }
  }
`;

export interface EntityPolicyCreateMutationInput {
  role?: string;
  userId?: string;
  entityId: string;
  entityName: string;
  action: string;
  inheritsChildren?: boolean;
}

export const CREATE_ENTITY_POLICY_MUTATION = `
  mutation CreateEntityPolicy($input: EntityPolicyCreateInput!) {
    createEntityPolicy(input: $input) {
      id
      ptype
      v0
      v1
      v2
    }
  }
`;

export const DELETE_PERMISSION_MUTATION = `
  mutation DeletePermission($id: UUID!) {
    deletePermission(id: $id)
  }
`;
