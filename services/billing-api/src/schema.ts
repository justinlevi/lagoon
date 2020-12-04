import { gql } from "apollo-server";

export const typeDefs = gql`
  scalar JSON

  enum Currency {
    AUD
    EUR
    GBP
    USD
    CHF
    ZAR
  }

  type Project {
    id: Int
    name: String
    costs(month: String): JSON
  }

  type BillingGroup {
    id: String
    name: String
    projects: [Project]
    currency: String
    billingSoftware: String
    modifiers: [BillingModifier]
    costs(month: String): JSON
  }

  type BillingModifier {
    id: Int
    startDate: String
    endDate: String
    discountFixed: Float
    discountPercentage: Float
    extraFixed: Float
    extraPercentage: Float
    min: Float
    max: Float
    customerComments: String
    adminComments: String
    weight: Int
  }

  input AddBillingModifierInput {
    group: BillingGroupInput!
    startDate: String!
    endDate: String!
    discountFixed: Float
    discountPercentage: Float
    extraFixed: Float
    extraPercentage: Float
    min: Float
    max: Float
    customerComments: String
    adminComments: String!
    weight: Int
  }

  input BillingModifierPatchInput {
    group: BillingGroupInput
    startDate: String
    endDate: String
    discountFixed: Float
    discountPercentage: Float
    extraFixed: Float
    extraPercentage: Float
    min: Float
    max: Float
    customerComments: String
    adminComments: String
    weight: Int
  }

  input UpdateBillingModifierInput {
    id: Int!
    patch: BillingModifierPatchInput!
  }

  input DeleteBillingModifierInput {
    id: Int!
  }

  input BillingGroupInput {
    id: String
    name: String
  }

  input ProjectInput {
    id: Int
    name: String
  }

  input AddBillingGroupInput {
    name: String!
    currency: Currency!
    billingSoftware: String
  }

  input ProjectBillingGroupInput {
    group: BillingGroupInput!
    project: ProjectInput!
  }

  input UpdateBillingGroupPatchInput {
    name: String!
    currency: Currency
    billingSoftware: String
    uptimeRobotStatusPageId: String
  }

  input UpdateBillingGroupInput {
    group: BillingGroupInput!
    patch: UpdateBillingGroupPatchInput!
  }

  type Query {
    billingGroup(input: BillingGroupInput!): BillingGroup
    allBillingGroups: [BillingGroup]
    billingGroupCost(input: BillingGroupInput!, month: String): JSON
    billingGroupModifiers(input: BillingGroupInput!, month: String): [BillingModifier]
    allBillingGroupCosts(month: String): JSON
    projectCost(input: ProjectInput!, month: String): JSON
  }

  type Mutation {
    addBillingGroup(input: AddBillingGroupInput!): BillingGroup
    updateBillingGroup(input: UpdateBillingGroupInput!): BillingGroup
    deleteBillingGroup(input: BillingGroupInput!): String
    addProjectToBillingGroup(input: ProjectBillingGroupInput): Project
    updateProjectBillingGroup(input: ProjectBillingGroupInput): Project
    removeProjectFromBillingGroup(input: ProjectBillingGroupInput): Project
    addBillingModifier(input: AddBillingModifierInput!): BillingModifier
    updateBillingModifier(input: UpdateBillingModifierInput!): BillingModifier
    deleteBillingModifier(input: DeleteBillingModifierInput!): String
    deleteAllBillingModifiersByBillingGroup(input: BillingGroupInput!): String
  }
`;

export default typeDefs;