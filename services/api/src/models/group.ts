import * as R from 'ramda';
import { asyncPipe } from '@lagoon/commons/src/util';
import pickNonNil from '../util/pickNonNil';
import * as logger from '../logger';
import GroupRepresentation from 'keycloak-admin/lib/defs/groupRepresentation';
import { User } from './user';
import { projectsByGroup, Project } from './project';
import {
  getProjectsData,
  availabiltyProjectsCosts,
  extractMonthYear,
} from '../resources/billing/helpers';

export interface Group {
  name: string;
  id?: string;
  type?: string;
  currency?: string;
  path?: string;
  parentGroupId?: string;
  // Only groups that aren't role subgroups.
  groups?: Group[] | BillingGroup[];
  members?: GroupMembership[];
  // All subgroups according to keycloak.
  subGroups?: GroupRepresentation[];
  attributes?: object;
}

export interface BillingGroup extends Group {
  currency?: string;
  billingSoftware?: string;
}

interface GroupMembership {
  user: User;
  role: string;
  roleSubgroupId: string;
}

interface GroupEdit {
  id: string;
  name: string;
  attributes?: object;
}

interface AttributeFilterFn {
  (attribute: { name: string; value: string[] }, group: Group): boolean;
}

interface GroupModel {
  loadAllGroups: () => Promise<Group[] | BillingGroup[]>;
  loadGroupById: (id: string) => Promise<Group | BillingGroup>;
  loadGroupByName: (name: string) => Promise<Group | BillingGroup>;
  loadGroupByIdOrName: (groupInput: GroupEdit) => Promise<Group | BillingGroup>;
  loadParentGroup: (groupInput: Group) => Promise<Group | BillingGroup>;
  loadGroupsByAttribute: (
    filterFn: AttributeFilterFn,
  ) => Promise<Group[] | BillingGroup[]>;
  loadGroupsByProjectId: (
    projectId: number,
  ) => Promise<Group[] | BillingGroup[]>;
  getProjectsFromGroupAndParents: (group: Group) => Promise<number[]>;
  getProjectsFromGroupAndSubgroups: (group: Group) => Promise<number[]>;
  addGroup: (groupInput: Group) => Promise<Group | BillingGroup>;
  updateGroup: (groupInput: GroupEdit) => Promise<Group | BillingGroup>;
  deleteGroup: (id: string) => Promise<void>;
  addUserToGroup: (
    user: User,
    group: Group,
    role: string,
  ) => Promise<Group | BillingGroup>;
  removeUserFromGroup: (
    user: User,
    group: Group,
  ) => Promise<Group | BillingGroup>;
  addProjectToGroup: (projectId: number, group: Group) => Promise<void>;
  removeProjectFromGroup: (projectId: number, group: Group) => Promise<void>;
  billingGroupCost: (groupInput: any, yearMonth: any) => Promise<any>;
  allBillingGroupCosts: (yearMonth: string) => Promise<any>;
}

export class GroupExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupExistsError';
  }
}

export class GroupNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupNotFoundError';
  }
}

const attrLens = R.lensPath(['attributes']);
const lagoonProjectsLens = R.lensPath(['lagoon-projects']);

const attrLagoonProjectsLens = R.compose(
  // @ts-ignore
  attrLens,
  lagoonProjectsLens,
  R.lensPath([0]),
);

export const isRoleSubgroup = R.pathEq(
  ['attributes', 'type', 0],
  'role-subgroup',
);

const attributeKVOrNull = (key: string, group: GroupRepresentation) =>
  String(R.pathOr(null, ['attributes', key], group));

export const Group = (clients): GroupModel => {
  const { keycloakAdminClient } = clients;

  const transformKeycloakGroups = async (
    keycloakGroups: GroupRepresentation[],
  ): Promise<Group[] | BillingGroup[]> => {
    // Map from keycloak object to group object
    const groups = keycloakGroups.map((keycloakGroup: GroupRepresentation):
      | Group
      | BillingGroup => ({
      id: keycloakGroup.id,
      name: keycloakGroup.name,
      type: attributeKVOrNull('type', keycloakGroup),
      currency: attributeKVOrNull('currency', keycloakGroup),
      billingSoftware: attributeKVOrNull('billingSoftware', keycloakGroup),
      path: keycloakGroup.path,
      attributes: keycloakGroup.attributes,
      subGroups: keycloakGroup.subGroups,
    }));

    let groupsWithGroupsAndMembers = [];

    for (const group of groups) {
      groupsWithGroupsAndMembers.push({
        ...group,
        groups: await transformKeycloakGroups(
          R.reject(isRoleSubgroup)(group.subGroups),
        ),
        members: await getGroupMembership(group),
      });
    }

    return groupsWithGroupsAndMembers;
  };

  const loadGroupById = async (id: string): Promise<Group | BillingGroup> => {
    const keycloakGroup = await keycloakAdminClient.groups.findOne({
      id,
    });

    if (R.isNil(keycloakGroup)) {
      throw new GroupNotFoundError(`Group not found: ${id}`);
    }

    const groups = await transformKeycloakGroups([keycloakGroup]);

    return groups[0];
  };

  const loadGroupByName = async (
    name: string,
  ): Promise<Group | BillingGroup> => {
    const keycloakGroups = await keycloakAdminClient.groups.find({
      search: name,
    });

    if (R.isEmpty(keycloakGroups)) {
      throw new GroupNotFoundError(`Group not found: ${name}`);
    }

    // Use mutable operations to avoid running out of heap memory
    const flattenGroups = (groups, group) => {
      groups.push(R.omit(['subGroups'], group));
      const flatSubGroups = group.subGroups.reduce(flattenGroups, []);
      return groups.concat(flatSubGroups);
    };

    const groupId = R.pipe(
      R.reduce(flattenGroups, []),
      R.filter(R.propEq('name', name)),
      R.path(['0', 'id']),
    )(keycloakGroups);

    if (R.isNil(groupId)) {
      throw new GroupNotFoundError(`Group not found: ${name}`);
    }

    // @ts-ignore
    return await loadGroupById(groupId);
  };

  const loadGroupByIdOrName = async (
    groupInput: GroupEdit,
  ): Promise<Group | BillingGroup> => {
    if (R.prop('id', groupInput)) {
      return loadGroupById(R.prop('id', groupInput));
    }

    if (R.prop('name', groupInput)) {
      return loadGroupByName(R.prop('name', groupInput));
    }

    throw new Error('You must provide a group id or name');
  };

  const loadAllGroups = async (): Promise<Group[] | BillingGroup[]> => {
    const keycloakGroups = await keycloakAdminClient.groups.find();

    let fullGroups: Group[] | BillingGroup[] = [];
    for (const group of keycloakGroups) {
      const fullGroup = await loadGroupById(group.id);

      fullGroups = [...fullGroups, fullGroup];
    }

    return fullGroups;
  };

  const loadParentGroup = async (
    groupInput: Group,
  ): Promise<Group | BillingGroup> =>
    asyncPipe(
      R.prop('path'),
      R.split('/'),
      R.nth(-2),
      R.cond([[R.isEmpty, R.always(null)], [R.T, loadGroupByName]]),
    )(groupInput);

  const loadGroupsByAttribute = async (
    filterFn: AttributeFilterFn,
  ): Promise<Group[] | BillingGroup[]> => {
    const allGroups = await loadAllGroups();

    const filteredGroups = R.filter((group: Group) =>
      R.pipe(
        R.toPairs,
        R.reduce((isMatch: boolean, attribute: [string, string[]]): boolean => {
          if (!isMatch) {
            return filterFn(
              {
                name: attribute[0],
                value: attribute[1],
              },
              group,
            );
          }

          return isMatch;
        }, false),
      )(group.attributes),
    )(allGroups);

    return filteredGroups;
  };

  const loadGroupsByProjectId = async (
    projectId: number,
  ): Promise<Group[] | BillingGroup[]> => {
    const filterFn = attribute => {
      if (attribute.name === 'lagoon-projects') {
        const value = R.is(Array, attribute.value)
          ? R.path(['value', 0], attribute)
          : attribute.value;
        return R.test(new RegExp(`\\b${projectId}\\b`), value);
      }

      return false;
    };

    return loadGroupsByAttribute(filterFn);
  };

  // Recursive function to load projects "up" the group chain
  const getProjectsFromGroupAndParents = async (
    group: Group,
  ): Promise<number[]> => {
    const projectIds = R.pipe(
      R.pathOr('', ['attributes', 'lagoon-projects', 0]),
      R.split(','),
      R.reject(R.isEmpty),
    )(group);

    const parentGroup = await loadParentGroup(group);
    const parentProjectIds = parentGroup
      ? await getProjectsFromGroupAndParents(parentGroup)
      : [];

    return [
      // @ts-ignore
      ...projectIds,
      ...parentProjectIds,
    ];
  };

  // Recursive function to load projects "down" the group chain
  const getProjectsFromGroupAndSubgroups = async (
    group: Group,
  ): Promise<number[]> => {
    const groupProjectIds = R.pipe(
      R.pathOr('', ['attributes', 'lagoon-projects', 0]),
      R.split(','),
      R.reject(R.isEmpty),
    )(group);

    let subGroupProjectIds = [];
    for (const subGroup of group.groups) {
      const projectIds = await getProjectsFromGroupAndSubgroups(subGroup);
      subGroupProjectIds = [...subGroupProjectIds, ...projectIds];
    }

    return [
      // @ts-ignore
      ...groupProjectIds,
      ...subGroupProjectIds,
    ];
  };

  const getGroupMembership = async (
    group: Group,
  ): Promise<GroupMembership[]> => {
    const UserModel = User({ keycloakAdminClient });
    const roleSubgroups = group.subGroups.filter(isRoleSubgroup);

    let membership = [];
    for (const roleSubgroup of roleSubgroups) {
      const keycloakUsers = await keycloakAdminClient.groups.listMembers({
        id: roleSubgroup.id,
      });

      let members = [];
      for (const keycloakUser of keycloakUsers) {
        const fullUser = await UserModel.loadUserById(keycloakUser.id);
        const member = {
          user: fullUser,
          role: roleSubgroup.realmRoles[0],
          roleSubgroupId: roleSubgroup.id,
        };

        members = [...members, member];
      }

      membership = [...membership, ...members];
    }

    return membership;
  };

  const addGroup = async (groupInput: Group): Promise<Group | BillingGroup> => {
    // Don't allow duplicate subgroup names
    try {
      const existingGroup = await loadGroupByName(groupInput.name);
      throw new Error('group-with-name-exists');
    } catch (err) {
      if (err instanceof GroupNotFoundError) {
        // No group exists with this name already, continue
      } else if (err.message == 'group-with-name-exists') {
        throw new GroupExistsError(
          `Group ${R.prop('name', groupInput)} exists`,
        );
      } else {
        throw err;
      }
    }

    let response: { id: string };
    try {
      // @ts-ignore
      response = await keycloakAdminClient.groups.create({
        ...pickNonNil(['id', 'name', 'attributes'], groupInput),
      });
    } catch (err) {
      if (err.response.status && err.response.status === 409) {
        throw new GroupExistsError(
          `Group ${R.prop('name', groupInput)} exists`,
        );
      } else {
        throw new Error(`Error creating Keycloak group: ${err.message}`);
      }
    }

    const group = await loadGroupById(response.id);

    // Set the parent group
    if (R.prop('parentGroupId', groupInput)) {
      try {
        const parentGroup = await loadGroupById(
          R.prop('parentGroupId', groupInput),
        );

        await keycloakAdminClient.groups.setOrCreateChild(
          {
            id: parentGroup.id,
          },
          {
            id: group.id,
          },
        );
      } catch (err) {
        if (err instanceof GroupNotFoundError) {
          throw new GroupNotFoundError(
            `Parent group not found ${R.prop('parentGroupId', groupInput)}`,
          );
        } else if (
          err.message.includes('location header is not found in request')
        ) {
          // This is a bug in the keycloak client, ignore
        } else {
          logger.error(`Could not set parent group: ${err.message}`);
        }
      }
    }

    return group;
  };

  const updateGroup = async (
    groupInput: GroupEdit,
  ): Promise<Group | BillingGroup> => {
    const oldGroup = await loadGroupById(groupInput.id);

    try {
      await keycloakAdminClient.groups.update(
        {
          id: groupInput.id,
        },
        //@ts-ignore
        {
          ...pickNonNil(['name', 'attributes'], groupInput),
        },
      );
    } catch (err) {
      if (err.response.status && err.response.status === 409) {
        throw new GroupExistsError(
          `Group ${R.prop('name', groupInput)} exists`,
        );
      } else if (err.response.status && err.response.status === 404) {
        throw new GroupNotFoundError(`Group not found: ${groupInput.id}`);
      } else {
        throw new Error(`Error updating Keycloak group: ${err.message}`);
      }
    }

    let newGroup = await loadGroupById(groupInput.id);

    if (oldGroup.name != newGroup.name) {
      const roleSubgroups = newGroup.subGroups.filter(isRoleSubgroup);

      for (const roleSubgroup of roleSubgroups) {
        await updateGroup({
          id: roleSubgroup.id,
          name: R.replace(oldGroup.name, newGroup.name, roleSubgroup.name),
        });
      }
    }

    return newGroup;
  };

  const deleteGroup = async (id: string): Promise<void> => {
    try {
      await keycloakAdminClient.groups.del({ id });
    } catch (err) {
      if (err.response.status && err.response.status === 404) {
        throw new GroupNotFoundError(`Group not found: ${id}`);
      } else {
        throw new Error(`Error deleting group ${id}: ${err}`);
      }
    }
  };

  const addUserToGroup = async (
    user: User,
    groupInput: Group,
    roleName: string,
  ): Promise<Group | BillingGroup> => {
    const group = await loadGroupById(groupInput.id);
    // Load or create the role subgroup.
    let roleSubgroup: Group;
    // @ts-ignore
    roleSubgroup = R.find(R.propEq('name', `${group.name}-${roleName}`))(
      group.subGroups,
    );
    if (!roleSubgroup) {
      roleSubgroup = await addGroup({
        name: `${group.name}-${roleName}`,
        parentGroupId: group.id,
        attributes: {
          type: ['role-subgroup'],
        },
      });
      const role = await keycloakAdminClient.roles.findOneByName({
        name: roleName,
      });
      await keycloakAdminClient.groups.addRealmRoleMappings({
        id: roleSubgroup.id,
        roles: [{ id: role.id, name: role.name }],
      });
    }

    // Add the user to the role subgroup.
    try {
      await keycloakAdminClient.users.addToGroup({
        id: user.id,
        groupId: roleSubgroup.id,
      });
    } catch (err) {
      throw new Error(`Could not add user to group: ${err.message}`);
    }

    return await loadGroupById(group.id);
  };

  const removeUserFromGroup = async (
    user: User,
    group: Group,
  ): Promise<Group | BillingGroup> => {
    const members = await getGroupMembership(group);
    const userMembership = R.find(R.pathEq(['user', 'id'], user.id))(members);

    if (userMembership) {
      // Remove user from the role subgroup.
      try {
        await keycloakAdminClient.users.delFromGroup({
          // @ts-ignore
          id: userMembership.user.id,
          // @ts-ignore
          groupId: userMembership.roleSubgroupId,
        });
      } catch (err) {
        throw new Error(`Could not remove user from group: ${err.message}`);
      }
    }

    return await loadGroupById(group.id);
  };

  const addProjectToGroup = async (
    projectId: number,
    groupInput: any,
  ): Promise<void> => {
    const group = await loadGroupById(groupInput.id);
    const newGroupProjects = R.pipe(
      R.view(attrLagoonProjectsLens),
      R.defaultTo(`${projectId}`),
      R.split(','),
      R.append(`${projectId}`),
      R.uniq,
      R.join(','),
    )(group);

    try {
      await keycloakAdminClient.groups.update(
        {
          id: group.id,
        },
        {
          attributes: {
            ...group.attributes,
            'lagoon-projects': [newGroupProjects],
          },
        },
      );
    } catch (err) {
      throw new Error(
        `Error setting projects for group ${group.name}: ${err.message}`,
      );
    }
  };

  const removeProjectFromGroup = async (
    projectId: number,
    group: Group,
  ): Promise<void> => {
    const newGroupProjects = R.pipe(
      R.view(attrLagoonProjectsLens),
      R.defaultTo(''),
      R.split(','),
      R.without([`${projectId}`]),
      R.uniq,
      R.join(','),
    )(group);

    try {
      await keycloakAdminClient.groups.update(
        {
          id: group.id,
        },
        {
          attributes: {
            ...group.attributes,
            'lagoon-projects': [newGroupProjects],
          },
        },
      );
    } catch (err) {
      throw new Error(
        `Error setting projects for group ${group.name}: ${err.message}`,
      );
    }
  };

  type availabilityProjectCostsType = {
    hitCost: number;
    storageCost: number;
    environmentCost: {
      prod: number;
      dev: number;
    };
    projects: [Project];
  };

  const billingGroupCost = async (groupInput, yearMonth) => {
    const group = (await loadGroupByIdOrName(groupInput)) as BillingGroup;
    const { id, currency, name } = group;
    const { month, year } = extractMonthYear(yearMonth);

    const groupProjects = await projectsByGroup(group);

    const initialProjects = groupProjects.map(({ id, name, availability }) => ({
      id, name, availability, month, year
    }));

    const projects = await getProjectsData(initialProjects, yearMonth);

    const high = availabiltyProjectsCosts(
      projects,
      'HIGH',
      currency,
    ) as availabilityProjectCostsType;
    const standard = availabiltyProjectsCosts(
      projects,
      'STANDARD',
      currency,
    ) as availabilityProjectCostsType;

    const availability = high.projects ? 'HIGH' : 'STANDARD';

    return { id, name, currency, availability, ...high, ...standard };
  };

  const allBillingGroupCosts = async yearMonth => {
    const allGroups = await loadAllGroups();
    const filterFn = (key, val) => group => group[key].includes(val);
    const billingGroups = allGroups.filter(filterFn('type', 'billing'));

    const billingGroupCosts = [];
    for (let i = 0; i < billingGroups.length; i++) {
      const group = billingGroups[i];
      billingGroupCosts.push(
        await billingGroupCost({ id: group.id }, yearMonth),
      );
    }

    return billingGroupCosts
      .map(billingGroup => {
        if (billingGroup.availability === 'STANDARD') {
          billingGroup.projects.map(project => {
            project.environments = undefined;
          });
        }

        if (billingGroup.availability === 'HIGH') {
          billingGroup.projects.map(project => {
            project.environments = undefined;
          });
        }

        return billingGroup;
      })
      .sort((a, b) => a.currency.localeCompare(b.currency));
  };

  return {
    loadAllGroups,
    loadGroupById,
    loadGroupByName,
    loadGroupByIdOrName,
    loadParentGroup,
    loadGroupsByAttribute,
    loadGroupsByProjectId,
    getProjectsFromGroupAndParents,
    getProjectsFromGroupAndSubgroups,
    addGroup,
    updateGroup,
    deleteGroup,
    addUserToGroup,
    removeUserFromGroup,
    addProjectToGroup,
    removeProjectFromGroup,
    billingGroupCost,
    allBillingGroupCosts,
  };
};
