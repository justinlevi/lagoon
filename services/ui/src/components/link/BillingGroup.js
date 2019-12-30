import Link from 'next/link';

export const getLinkData = billingGroupSlug => ({
  urlObject: {
    pathname: '/billin',
    query: { billingGroupName: billingGroupSlug }
  },
  asPath: `/billing/${billingGroupSlug}`
});

/**
 * Links to the billing page given the billing name.
 */
const ProjectLink = ({
  billingGroupSlug,
  children,
  className = null,
  prefetch = false
}) => {
  const linkData = getLinkData(billingGroupSlug);

  return (
    <Link href={linkData.urlObject} as={linkData.asPath} prefetch={prefetch}>
      <a className={className}>{children}</a>
    </Link>
  );
};

export default ProjectLink;
