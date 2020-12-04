import { Project } from "./model/project";

export const resolvers: any = {
  Query: {
    billingGroup: () => {},
    allBillingGroups: () => ([{}]),
    billingGroupCost: () => {},
    billingGroupModifiers: () => {},
    allBillingGroupCosts: () => {},
    projectCost: () => {},
  },
  Mutation: {
    addBillingGroup: () => {},
    updateBillingGroup: () => {},
    deleteBillingGroup: () => '',
    addProjectToBillingGroup: () => {},
    updateProjectBillingGroup: () => {},
    removeProjectFromBillingGroup: () => {},
    addBillingModifier: () => {},
    updateBillingModifier: () => {},
    deleteBillingModifier: () => {},
    deleteAllBillingModifiersByBillingGroup: () => 'true'
  }
}

export default resolvers;