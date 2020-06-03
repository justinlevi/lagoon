import axios from 'axios';
import { pathOr, propOr } from 'ramda';

const API_HOST = propOr('http://gitlab', 'GITLAB_API_HOST', process.env);
const API_TOKEN = propOr(
  'personal access token',
  'GITLAB_API_TOKEN',
  process.env
);

const options = {
  baseURL: `${API_HOST}/api/v4/`,
  timeout: 30000,
  headers: {
    'Private-Token': API_TOKEN
  }
};

const gitlabapi = axios.create(options);

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

class APIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitLabAPIError';
  }
}

const getRequest = async (url: string): Promise<any> => {
  try {
    const response = await gitlabapi.get(url);
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorMessage = pathOr(
        error.message,
        ['data', 'message'],
        error.response
      );
      const errorString =
        typeof errorMessage === 'string'
          ? errorMessage
          : JSON.stringify(errorMessage);

      throw new APIError(errorString);
    } else if (error.request) {
      throw new NetworkError(error.message);
    } else {
      throw error;
    }
  }
};

const postRequest = async (url: string, body: any): Promise<any> => {
  try {
    const response = await gitlabapi.post(url, body);
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorMessage = pathOr(
        error.message,
        ['data', 'message'],
        error.response
      );
      const errorString =
        typeof errorMessage === 'string'
          ? errorMessage
          : JSON.stringify(errorMessage);

      throw new APIError(errorString);
    } else if (error.request) {
      throw new NetworkError(error.message);
    } else {
      throw error;
    }
  }
};

const getAllPagesRequest = async (url: string): Promise<any> => {
  let page = 1;
  let moreResults = true;
  let results = [];

  do {
    try {
      const response = await gitlabapi.get(url, {
        params: {
          per_page: 100,
          page
        }
      });

      if (response.data.length === 0) {
        moreResults = false;
      } else {
        page++;
        results = [...results, ...response.data];
      }
    } catch (error) {
      if (error.response) {
        const errorMessage = pathOr(
          error.message,
          ['data', 'message'],
          error.response
        );
        const errorString =
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage);

        throw new APIError(errorString);
      } else if (error.request) {
        throw new NetworkError(error.message);
      } else {
        throw error;
      }
    }
  } while (moreResults);

  return results;
};

export const getUserByUsername = async (username: string): Promise<any> => {
  try {
    const response = await gitlabapi.get('users', {
      params: {
        username
      }
    });

    if (response.data.length === 0) {
      throw new APIError(`No user found with username: ${username}`);
    }

    return response.data[0];
  } catch (error) {
    if (error.response) {
      const errorMessage = pathOr(
        error.message,
        ['data', 'message'],
        error.response
      );
      const errorString =
        typeof errorMessage === 'string'
          ? errorMessage
          : JSON.stringify(errorMessage);

      throw new APIError(errorString);
    } else if (error.request) {
      throw new NetworkError(error.message);
    } else {
      throw error;
    }
  }
};

export const getAllGroups = async () => getAllPagesRequest('groups');
export const getGroup = async (groupId: number): Promise<any> =>
  getRequest(`groups/${groupId}`);
export const getGroupMembers = async (groupId: number): Promise<any> =>
  getRequest(`groups/${groupId}/members`);
export const getAllProjects = async (): Promise<any> =>
  getAllPagesRequest('projects');
export const getProject = async (projectId: number): Promise<any> =>
  getRequest(`projects/${projectId}`);
export const getProjectMembers = async (projectId: number): Promise<any> =>
  getRequest(`projects/${projectId}/members`);
export const getAllUsers = async () => getAllPagesRequest('users');
export const getUser = async (userId: number): Promise<any> =>
  getRequest(`users/${userId}`);
export const getSshKey = async (keyId: number): Promise<any> =>
  getRequest(`keys/${keyId}`);

export const addDeployKeyToProject = async (
  projectId: number,
  key: string
): Promise<any> =>
  postRequest(`projects/${projectId}/deploy_keys`, {
    title: 'Lagoon Project Key',
    key,
    can_push: false
  });
