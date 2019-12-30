import React from 'react';
import * as R from 'ramda';
import Head from 'next/head';
import { Query } from 'react-apollo';
import MainLayout from 'layouts/MainLayout';
import AllBillingQuery from 'lib/query/AllBilling';
import BillingGroups from 'components/BillingGroups';
import withQueryLoading from 'lib/withQueryLoading';
import withQueryError from 'lib/withQueryError';
import { bp } from 'lib/variables';

/**
 * Displays the projects page.
 */
const BillingPage = () => (
  <>
    <Head>
      <title>Billing Groups</title>
    </Head>
    <Query query={AllBillingQuery} displayName="AllBillingQuery">
      {R.compose(
        withQueryLoading,
        withQueryError
      )(({ data }) => (
        <MainLayout>
          <div className="content-wrapper">
            <h2>Billing</h2>
            <div className="content">
              <BillingGroups billingGroups={data.allGroups || []} />
            </div>
          </div>
          <style jsx>{`
            .content-wrapper {
              h2 {
                margin: 38px calc((100vw / 16) * 1) 0;
                @media ${bp.wideUp} {
                  margin: 62px calc((100vw / 16) * 2) 0;
                }
                @media ${bp.extraWideUp} {
                  margin: 62px calc((100vw / 16) * 3) 0;
                }
              }
              .content {
                margin: 38px calc((100vw / 16) * 1);
                @media ${bp.wideUp} {
                  margin: 38px calc((100vw / 16) * 2);
                }
                @media ${bp.extraWideUp} {
                  margin: 38px calc((100vw / 16) * 3);
                }
              }
            }
          `}</style>
        </MainLayout>
      ))}
    </Query>
  </>
);

export default BillingPage;
