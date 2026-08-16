import { LestaUser, LestaTankStats, LestaTankInfo } from './types'

const LESTA_API_BASE = process.env.LESTA_API_BASE_URL || 'https://api.lestagames.ru'
const APPLICATION_ID = process.env.LESTA_APPLICATION_ID!

export class LestaClient {
  private accessToken: string
  
  constructor(accessToken: string) {
    this.accessToken = accessToken
  }
  
  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const queryParams = new URLSearchParams({
      application_id: APPLICATION_ID,
      ...params
    })
    
    const response = await fetch(`${LESTA_API_BASE}${endpoint}?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Lesta API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.data
  }
  
  async getPlayerInfo(accountId: number): Promise<LestaUser> {
    const data = await this.request<any>(`/wot/account/info/`, {
      account_id: accountId
    })
    return data[accountId]
  }
  
  async getTankStats(accountId: number, tankId?: number): Promise<LestaTankStats[]> {
    const params: Record<string, any> = {
      account_id: accountId,
      fields: 'tank_id,all.battles,all.damage_dealt,all.frags,all.xp,all.wins'
    }
    
    if (tankId) {
      params.tank_id = tankId
    }
    
    return this.request<LestaTankStats[]>(`/wot/tanks/stats/`, params)
  }
  
  async getTankInfo(tankId: number): Promise<LestaTankInfo> {
    const data = await this.request<any>(`/wot/encyclopedia/vehicles/`, {
      tank_id: tankId
    })
    return data[tankId]
  }
}
