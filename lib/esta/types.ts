export interface LestaUser {
  account_id: number
  nickname: string
  created_at: number
  updated_at: number
  last_battle_time: number
  logout_at: number
  global_rating: number
  statistics: {
    all: {
      battles: number
      wins: number
      losses: number
      damage_dealt: number
      frags: number
      xp: number
    }
  }
}

export interface LestaTankStats {
  tank_id: number
  all: {
    battles: number
    damage_dealt: number
    frags: number
    xp: number
    wins: number
  }
}

export interface LestaTankInfo {
  tank_id: number
  name: string
  tier: number
  type: string
  nation: string
  is_premium: boolean
}
