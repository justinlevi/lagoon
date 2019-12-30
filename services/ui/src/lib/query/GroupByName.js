import gql from 'graphql-tag';

export default gql`
  query groupByName($name: String!) {
    group: groupByName(name:$name){
      id, name, type
      ... on BillingGroup {
        currency, billingSoftware, modifiers{ id, startDate, endDate}
      }
    }
  }
`;
