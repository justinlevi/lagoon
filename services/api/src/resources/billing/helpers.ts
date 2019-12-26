import R from 'ramda';

import { getSqlClient, USE_SINGLETON } from '../../clients/sqlClient';
import Sql from './sql';
import { query } from '../../util/db';
import { projectEnvironmentsWithData } from '../../models/environment';
import { BillingModifier } from '../../models/billing';
import {
  calculateProjectEnvironmentsTotalsToBill,
  getProjectsCosts,
  BillingGroupCosts
} from './billingCalculations';
import { Group } from '../../models/group';
import moment from 'moment';

// helper function to split the input string
export const extractMonthYear = yearMonth => {
  const splits = yearMonth.split('-');
  return {
    month: splits[1],
    year: splits[0],
  };
};

/**
 * Creates a function to get all EnvironmentData and billing cost totals from a project.
 *   Used in map functions to iterate over a list of projects
 *
 * @param {string} yearMonth the environment id
 *
 * @return {Function} A function that takes a project and returns billing data for that month
 */
export const projectWithBillingDataFn = (
  yearMonth: string,
) => async project => {
  const { id } = project;
  const envs = await projectEnvironmentsWithData(id, yearMonth);
  const projectData = calculateProjectEnvironmentsTotalsToBill(envs);
  return { ...project, ...projectData, environments: envs };
};

/**
 * Get all billing data for the provided projects
 *
 * @param {[Project]} projects an array of project
 * @param {string} yearMonth The year month string passed in we want to get data for.
 *
 * @return {Promise<[Project]>} An array of projects with billing data
 */
export const getProjectsData = async (projects, yearMonth: string) => {
  const billingDataFn = projectWithBillingDataFn(yearMonth);
  const projectsWithData = projects.map(billingDataFn);
  return Promise.all(projectsWithData);
};

// Helper function to filter projects by availability
const availabilityFilterFn = filterKey => ({ availability }) =>
  availability === filterKey;

/**
 * Filter out High or Standard availability and calculate costs
 *
 * @param {[Project]} projects an array of projects
 * @param {string} availability High or Standard
 * @param {string} currency the currency
 *
 * @return {BillingGroupCosts} An object includeing all availability costs
 */
export const availabiltyProjectsCosts = (
  projects,
  availability,
  currency,
  modifiers: [BillingModifier]
) => {
  const filteredProjects = projects.filter(availabilityFilterFn(availability));
  return (filteredProjects.length > 0
    ? getProjectsCosts(currency, filteredProjects, modifiers)
    : {}) as BillingGroupCosts;
};

export const handleAddBillingModifier = async (modifier: BillingModifier) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  const {
    info: { insertId }
  } = await query(sqlClient, Sql.addBillingModifier(modifier));
  const rows = await query(
    sqlClient,
    Sql.selectBillingModifier(parseInt(insertId, 10))
  );
  return R.prop(0, rows) as BillingModifier;
};

export const handleGetBillingGroupModifiers = async (
  gid: string,
  month: string
) => {
  const sqlClient = getSqlClient(USE_SINGLETON);

  const YEAR_MONTH = 'YYYY-MM-DD HH:mm:ss';
  const monthStart = month
    ? moment(new Date(month).toISOString()).startOf('month').format(YEAR_MONTH).toString()
    : undefined;
  const monthEnd = month
    ? moment(new Date(month).toISOString()).endOf('month').format(YEAR_MONTH).toString()
    : undefined;

  const sql = Sql.getAllBillingModifierByBillingGroup(
    gid,
    monthStart,
    monthEnd
  );
  const rows = await query(sqlClient, sql);
  return rows as [BillingModifier];
};

export const handleUpdateBillingModifier = async (
  id: number,
  patch: BillingModifier
) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  if (!R.isEmpty(patch)) {
    await query(sqlClient, Sql.updateBillingModifier(id, patch));
  }
  const rows = await query(sqlClient, Sql.selectBillingModifier(id));
  if (rows.length === 0) {
    throw new Error('Billing modifier does not exist.');
  }
  return R.prop(0, rows) as BillingModifier;
};

export const handleDeleteBillingModifier = async (id: number) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  await query(sqlClient, Sql.deleteBillingModifier(id));
  return 'success';
};

export const handleDeleteAllBillingGroupModifier = async (gid: string) => {
  const sqlClient = getSqlClient(USE_SINGLETON);
  const sql = Sql.deleteAllBillingModifiersByBillingGroup(gid);
  console.log(sql);
  await query(sqlClient, sql);
  return 'success';
}

export default {
  extractMonthYear,
  projectWithBillingDataFn,
  getProjectsData,
  availabiltyProjectsCosts,
  handleAddBillingModifier,
  handleGetBillingGroupModifiers,
  handleUpdateBillingModifier,
  handleDeleteBillingModifier
};
