'use client'

import { useState } from 'react'
import { submitFeedback } from '@/app/actions/feedback'

export function FeedbackPanel({
  qrToken,
  hasSubmittedFeedback,
  googleReviewUrl,
}: {
  qrToken: string
  hasSubmittedFeedback: boolean
  googleReviewUrl: string | null
}) {
  const [submittedRating, setSubmittedRating] = useState<number | null>(null)

  if (hasSubmittedFeedback || submittedRating !== null) {
    if (submittedRating !== null && submittedRating >= 4 && googleReviewUrl) {
      return (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-sage">¡Nos alegra! ¿Nos dejas una reseña?</p>
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white"
          >
            Dejar reseña en Google
          </a>
        </div>
      )
    }
    return <p className="text-sm text-sage">Gracias por tu opinión.</p>
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-sage">¿Cómo ha ido tu experiencia?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <form
            key={rating}
            action={submitFeedback}
            onSubmit={() => setSubmittedRating(rating)}
          >
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="rating" value={rating} />
            <button
              type="submit"
              className="text-2xl leading-none transition-transform hover:scale-110"
              aria-label={`${rating} estrellas`}
            >
              ⭐
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
