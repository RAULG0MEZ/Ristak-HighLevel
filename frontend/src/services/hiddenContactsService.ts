import apiClient from './apiClient'

export interface HiddenFilter {
  id: string
  filterText: string
  createdAt: string
}

export const hiddenContactsService = {
  async getFilters(): Promise<HiddenFilter[]> {
    try {
      const data = await apiClient.get<HiddenFilter[]>('/hidden-contacts')
      return data
    } catch (error) {
      console.error('Error fetching hidden filters:', error)
      return []
    }
  },

  async addFilter(filterText: string): Promise<HiddenFilter> {
    const data = await apiClient.post<HiddenFilter>('/hidden-contacts', { filterText })
    return data
  },

  async deleteFilter(id: string): Promise<void> {
    await apiClient.delete(`/hidden-contacts/${id}`)
  }
}
