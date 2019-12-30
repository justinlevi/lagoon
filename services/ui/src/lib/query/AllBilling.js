import gql from 'graphql-tag';

export default gql`
  {
    allGroups(type:"billing"){
      id, name, type
      ... on BillingGroup {
        currency, billingSoftware
      }
    }
  }
`;
