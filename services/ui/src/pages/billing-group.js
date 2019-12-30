import React from 'react';
import * as R from 'ramda';
import { withRouter } from 'next/router';
import Head from 'next/head';
import { Query } from 'react-apollo';
import MainLayout from 'layouts/MainLayout';
import GroupByNameQuery from 'lib/query/GroupByName';
import Breadcrumbs from 'components/Breadcrumbs';
// import BillingGroupBreadcrumb from 'components/Breadcrumbs/BillingGroup';
// import BillingGroupDetailsSidebar from 'components/BillingGroupDetailsSidebar';
// import Environments from 'components/Environments';
import withQueryLoading from 'lib/withQueryLoading';
import withQueryError from 'lib/withQueryError';
import { withBillingGroupRequired } from 'lib/withDataRequired';
import { bp, color } from 'lib/variables';

/**
 * Displays a billing group page, given the billing name.
 */
export const PageBillingGroup = ({ router }) => (
  <>
    <Head>
      <title>{`${router.query.billingGroupName} | BillingGroup`}</title>
    </Head>
    <Query
      query={GroupByNameQuery}
      variables={{ name: router.query.billingName }}
    >
      {R.compose(
        withQueryLoading,
        withQueryError,
        withBillingGroupRequired
      )(({ data: { billing } }) => {

        return (
          <MainLayout>
            <Breadcrumbs>
              {/* <BillingGroupBreadcrumb billingSlug={billing.name} /> */}
            </Breadcrumbs>
            <div className="content-wrapper">
              <div className="billing-details-sidebar">
                {/* <BillingGroupDetailsSidebar billing={billing} /> */}
              </div>
            </div>
            <style jsx>{`
              .content-wrapper {
                @media ${bp.tabletUp} {
                  display: flex;
                  justify-content: space-between;
                }
              }

              .billing-details-sidebar {
                background-color: ${color.lightestGrey};
                border-right: 1px solid ${color.midGrey};
                padding: 32px calc((100vw / 16) * 1);
                width: 100%;
                @media ${bp.xs_smallUp} {
                  padding: 24px calc((100vw / 16) * 1) 24px
                    calc(((100vw / 16) * 1.5) + 28px);
                }
                @media ${bp.tabletUp} {
                  min-width: 50%;
                  padding: 48px calc(((100vw / 16) * 1) + 28px);
                  width: 50%;
                }
                @media ${bp.desktopUp} {
                  min-width: 40%;
                  padding: 48px calc((100vw / 16) * 1);
                  width: 40%;
                }
                @media ${bp.wideUp} {
                  min-width: 33.33%;
                  min-width: calc((100vw / 16) * 5);
                  width: 33.33%;
                  width: calc((100vw / 16) * 5);
                }
              }

              .environments-wrapper {
                flex-grow: 1;
                padding: 40px calc((100vw / 16) * 1);
              }
            `}</style>
          </MainLayout>
        );
      })}
    </Query>
  </>
);

export default withRouter(PageBillingGroup);
