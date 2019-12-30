import React, { useState } from 'react';
import Link from 'next/link';
import css from 'styled-jsx/css';
import Highlighter from 'react-highlight-words';
import BillingGroupLink from 'components/link/BillingGroup';
import Box from 'components/Box';
import { bp, color, fontSize } from 'lib/variables';

const { className: boxClassName, styles: boxStyles } = css.resolve`
  .box {
    margin-bottom: 7px;

    .content {
      padding: 9px 20px 14px;
      @media ${bp.tinyUp} {
        display: flex;
      }
    }
  }
`;

/**
 * The primary list of billingGroups.
 */
const BillingGroups = ({ billingGroups = [] }) => {
  const [searchInput, setSearchInput] = useState('');

  const filteredBillingGroups = billingGroups.filter(key => {
    const sortByName = key.name
      .toLowerCase()
      .includes(searchInput.toLowerCase());
    return ['name'].includes(key)
      ? false
      : (true && sortByName);
  });

  return (
    <>
      <div className="header">
        <label>BillingGroup</label>
        <label></label>
        <input
          aria-labelledby="search"
          className="searchInput"
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Type to search"
          disabled={billingGroups.length === 0}
        />
      </div>
      {!billingGroups.length && (
        <Box>
          <div className="project">
            <h4>No billingGroups</h4>
          </div>
        </Box>
      )}
      {(searchInput && !filteredBillingGroups.length) && (
        <Box>
          <div className="project">
            <h4>No billingGroups matching "{searchInput}"</h4>
          </div>
        </Box>
      )}
      {filteredBillingGroups.map(billingGroup => (
        <BillingGroupLink billingGroupSlug={billingGroup.name.replace(/\s+/g, '-').toLowerCase()} key={billingGroup.id}>
          <Box className={boxClassName} >
            <div className="project">
              <h4>
                <Highlighter
                  searchWords={[searchInput]}
                  autoEscape={true}
                  textToHighlight={billingGroup.name}
                />
              </h4>
            </div>
            <div className="customer">

            </div>
          </Box>
        </BillingGroupLink>
      ))}
      <style jsx>{`
        .header {
          @media ${bp.tinyUp} {
            align-items: center;
            display: flex;
            justify-content: flex-end;
            margin: 0 0 14px;
          }
          @media ${bp.smallOnly} {
            flex-wrap: wrap;
          }
          @media ${bp.tabletUp} {
            margin-top: 40px;
          }
          .searchInput {
            background: url('/static/images/search.png') 12px center no-repeat
              ${color.white};
            background-size: 14px;
            border: 1px solid ${color.midGrey};
            height: 40px;
            padding: 0 12px 0 34px;
            transition: border 0.5s ease;
            @media ${bp.smallOnly} {
              margin-bottom: 20px;
              order: -1;
              width: 100%;
            }
            @media ${bp.tabletUp} {
              width: 30%;
            }
            &::placeholder {
              color: ${color.midGrey};
            }
            &:focus {
              border: 1px solid ${color.brightBlue};
              outline: none;
            }
          }
          label {
            display: none;
            padding-left: 20px;
            width: 50%;
            @media ${bp.tinyUp} {
              display: block;
            }
            &:nth-child(2) {
              @media ${bp.tabletUp} {
                width: 20%;
              }
            }
          }
        }
        .project {
          font-weight: normal;

          @media ${bp.tinyUp} {
            width: 50%;
          }
        }
        .route {
          color: ${color.linkBlue};
          line-height: 24px;
        }
        .customer {
          color: ${color.darkGrey};
          padding-top: 16px;
          @media ${bp.tinyUp} {
            padding-left: 20px;
          }
          @media ${bp.wideUp} {
            width: calc((100vw / 16) * 7);
          }
          @media ${bp.extraWideUp} {
            width: calc((100vw / 16) * 6);
          }
        }
      `}</style>
      {boxStyles}
    </>
  );
};

export default BillingGroups;
