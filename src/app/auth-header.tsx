import Image from 'next/image'
import Link from 'next/link'

export function AuthHeader() {
  return (
    <Link href="/" className="self-center">
      <Image
        src="/kratos-mark-light.png"
        alt="Kratos"
        width={743}
        height={338}
        priority
        className="h-20 w-auto sm:h-24"
      />
    </Link>
  )
}
