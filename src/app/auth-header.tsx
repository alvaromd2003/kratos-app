import Image from 'next/image'
import Link from 'next/link'

export function AuthHeader() {
  return (
    <div className="flex justify-center bg-gradient-to-b from-ink to-ink-2 py-8">
      <Link href="/">
        <Image
          src="/kratos-mark-light.png"
          alt="Kratos"
          width={743}
          height={338}
          priority
          className="h-8 w-auto"
        />
      </Link>
    </div>
  )
}
