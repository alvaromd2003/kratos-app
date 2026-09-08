import Image from 'next/image'
import Link from 'next/link'

export function AuthHeader() {
  return (
    <div className="flex justify-center pt-14 pb-6">
      <Link href="/">
        <Image
          src="/kratos-mark-light.png"
          alt="Kratos"
          width={743}
          height={338}
          priority
          className="h-16 w-auto sm:h-20"
        />
      </Link>
    </div>
  )
}
