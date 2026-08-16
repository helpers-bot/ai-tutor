'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Challenge } from '@/lib/types/database'

interface ChallengeCardProps {
  challenge: Challenge
  onParticipate?: (challengeId: string) => void
}

export function ChallengeCard({ challenge, onParticipate }: ChallengeCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2">{challenge.title}</h3>
        <p className="text-gray-600 mb-4">{challenge.description}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-sm text-gray-500">Цель:</span>
            <p className="font-semibold">
              {challenge.target_value} {getTargetLabel(challenge.target_type)}
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Боев:</span>
            <p className="font-semibold">{challenge.battles_limit}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Призовой фонд:</span>
            <p className="font-semibold text-green-600">{challenge.prize_pool} ⭐</p>
          </div>
          {challenge.tank_class && (
            <div>
              <span className="text-sm text-gray-500">Класс:</span>
              <p className="font-semibold">{challenge.tank_class}</p>
            </div>
          )}
        </div>
        
        {onParticipate && (
          <Button 
            onClick={() => onParticipate(challenge.id)}
            className="w-full"
          >
            Участвовать
          </Button>
        )}
      </div>
    </Card>
  )
}

function getTargetLabel(type: string): string {
  const labels: Record<string, string> = {
    damage: 'урона',
    frags: 'фрагов',
    xp: 'опыта',
    wins: 'побед'
  }
  return labels[type] || type
}
