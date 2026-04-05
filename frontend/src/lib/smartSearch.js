import { listingsAPI } from './api';

export const executeListingSearch = async ({
  query,
  city,
  category,
  limit = 50,
  fallbackParams = {},
}) => {
  const q = (query || '').trim();

  if (q) {
    const smartResponse = await listingsAPI.smartSearch(q, {
      city: city || undefined,
      category: category || undefined,
      limit,
    });

    return {
      mode: 'smart',
      listings: smartResponse?.data?.listings || [],
      didYouMean: smartResponse?.data?.did_you_mean || '',
      pages: 1,
    };
  }

  const response = await listingsAPI.getAll({ limit, ...fallbackParams });
  return {
    mode: 'regular',
    listings: response?.data?.listings || [],
    didYouMean: '',
    pages: response?.data?.pages || 1,
  };
};

export const fetchListingSuggestions = async ({
  query,
  city,
  category,
  limit = 6,
}) => {
  const q = (query || '').trim();
  if (q.length < 2) {
    return [];
  }

  const response = await listingsAPI.suggestSearch(q, {
    city: city || undefined,
    category: category || undefined,
    limit,
  });

  return response?.data?.suggestions || [];
};
