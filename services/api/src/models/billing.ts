import moment from 'moment';
import { Group, BillingGroup } from './group';
import { getKeycloakAdminClient } from '../clients/keycloak-admin';
import {
  handleAddBillingModifier,
  handleGetBillingGroupModifiers,
  handleUpdateBillingModifier,
  handleDeleteBillingModifier,
  handleDeleteAllBillingGroupModifier
} from '../resources/billing/helpers';

import { GroupInput } from './group';

export interface BillingModifier {
  id?: number;
  group?: Group | GroupInput;
  startDate?: string;
  endDate?: string;
  discountFixed?: number;
  discountPercentage?: number;
  extraFixed?: number;
  extraPercentage?: number;
  customerComments?: string;
  adminComments?: string;
  weight?: number;
}

export interface BillingModifierInput extends BillingModifier {
  group: GroupInput;
}

export interface AddBillingModifierInput {
  input: BillingModifierInput;
}

export interface UpdateBillingModifierInput {
  input: {
    id: number;
    patch: BillingModifier;
  };
}

export interface BillingModifiersInput {
  input: GroupInput;
  month?: string;
}

export interface DeleteBillingModifierInput {
  input: {
    id: number;
  };
}

export interface DeleteAllBillingGroupModifiersInput {
  input: GroupInput;
}

const loadGroup = async (group: GroupInput) => {
  const keycloakAdminClient = await getKeycloakAdminClient();
  const GroupModel = Group({ keycloakAdminClient });
  return GroupModel.loadGroupByIdOrName(group);
};

export const convertDateToMYSQLDateTimeFormat = (date: string) => {
  const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
  return moment(new Date(date).toISOString())
    .format(DATE_FORMAT)
    .toString();
};

const prepareAddBillingModifierFromInput = async (
  input: BillingModifierInput
) => {
  const { group: groupInput, ...rest } = input;
  const group = await loadGroup(groupInput);

  const startDate = convertDateToMYSQLDateTimeFormat(rest.startDate);
  const endDate = convertDateToMYSQLDateTimeFormat(rest.endDate);

  return {
    group,
    billingModifier: { ...rest, gid: group.id, startDate, endDate }
  };
};

/**
 * Create/Add Billing Modifier
 *
 * @param {AddBillingModifierInput} input The modifier values
 *
 * @return {BillingModifier} The created modifier
 */
export const addBillingModifier = async (input: BillingModifierInput) => {
  const { group, billingModifier } = await prepareAddBillingModifierFromInput(
    input
  );
  const result = await handleAddBillingModifier(billingModifier);

  return { ...result, group } as BillingModifier;
};

/**
 * Get All Billing Modifiers for a Billing Group
 *
 * @param {BillingModifierInput} input The modifier values
 *
 * @return {[BillingModifier]} The created modifier
 */
export const getBillingModifiers = async (
  groupInput: GroupInput,
  month: string
) => {
  const keycloakAdminClient = await getKeycloakAdminClient();
  const GroupModel = Group({ keycloakAdminClient });
  const group = await GroupModel.loadGroupByIdOrName(groupInput);

  const result = await handleGetBillingGroupModifiers(group.id, month);

  return result.map(modifier => ({ ...modifier, group }));
};

const prepareUpdateBillingModifierFromInput = async (
  id: number,
  input: BillingModifier
) => {
  const isGroupInputExists =
    typeof input != 'undefined' &&
    input.group &&
    (input.group.id || input.group.name);
  const group: BillingGroup | {} = isGroupInputExists
    ? (await loadGroup(input.group)).id
    : {};
  const gid = isGroupInputExists ? { gid: (group as BillingGroup).id } : {};

  const startDate =
    typeof input != 'undefined' && input.startDate
      ? { startDate: convertDateToMYSQLDateTimeFormat(input.startDate) }
      : {};
  const endDate =
    typeof input != 'undefined' && input.endDate
      ? { endDate: convertDateToMYSQLDateTimeFormat(input.endDate) }
      : {};

  return {
    group,
    billingModifier: { ...input, ...gid, ...startDate, ...endDate }
  };
};

/**
 * Update Billing Modifier
 *
 * @param {UpdateBillingModifierInput} input The modifier values
 *
 * @return {BillingModifier} The created modifier
 */
export const updateBillingModifier = async (
  id: number,
  input: BillingModifier
) => {
  const {
    group,
    billingModifier
  } = await prepareUpdateBillingModifierFromInput(id, input);
  const result = await handleUpdateBillingModifier(id, billingModifier);
  return { ...result, group };
};

/**
 * Delete Billing Modifier
 *
 * @param {DeleteBillingModifierInput} input The modifier values
 *
 * @return {BillingModifier} The created modifier
 */
export const deleteBillingModifier = async (id: number) =>
  handleDeleteBillingModifier(id);

/**
 * Delete All Billing Modifiers for a Billing Group
 *
 * @param {GroupInput} input The Billing Group
 *
 * @return {Boolean} Success
 */
export const deleteAllBillingGroupModifiers = async (
  groupInput: GroupInput
) => {
  const keycloakAdminClient = await getKeycloakAdminClient();
  const GroupModel = Group({ keycloakAdminClient });
  const group = await GroupModel.loadGroupByIdOrName(groupInput);

  return handleDeleteAllBillingGroupModifier(group.id);
};

export default {
  addBillingModifier,
  updateBillingModifier,
  deleteBillingModifier,
  deleteAllBillingGroupModifiers,
  getBillingModifiers
};
