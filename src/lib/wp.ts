const API_URL = 'http://localhost:8000/graphql';

export async function fetchAPI(query: string, { variables } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const json = await res.json();
  
  if (json.errors) {
    console.error(json.errors);
    throw new Error('Failed to fetch API');
  }

  return json.data;
}

export async function getPageBySlug(slug: string) {
  const data = await fetchAPI(`
    query GetPageBySlug($slug: ID!) {
      page(id: $slug, idType: URI) {
        title
        content
        slug
      }
    }
  `, {
    variables: { slug }
  });

  return data?.page;
}

export async function getAllPagesWithSlugs() {
  const data = await fetchAPI(`
    {
      pages(first: 100) {
        nodes {
          slug
        }
      }
    }
  `);

  return data?.pages?.nodes;
}
