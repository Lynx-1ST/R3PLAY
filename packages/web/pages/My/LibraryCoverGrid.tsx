import { Link } from 'react-router-dom'
import Image from '@/web/components/Image'
import { resizeImage } from '@/web/utils/common'

export default function LibraryCoverGrid({
  albums,
  playlists,
}: {
  albums?: Album[]
  playlists?: Playlist[]
}) {
  const items =
    albums?.map(album => ({
      id: album.id,
      url: `/album/${album.id}`,
      name: album.name,
      image: album.picUrl,
      subtitle: album.artists?.map(artist => artist.name).join(', '),
    })) ??
    playlists?.map(playlist => ({
      id: playlist.id,
      url: `/playlist/${playlist.id}`,
      name: playlist.name,
      image: playlist.coverImgUrl || playlist.picUrl,
      subtitle: playlist.creator?.nickname,
    })) ??
    []
  return (
    <div className='@container'>
      <div className='grid grid-cols-2 gap-x-4 gap-y-6 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @6xl:grid-cols-6'>
        {items.map(item => (
          <Link
            key={item.id}
            to={item.url}
            title={item.name}
            className='group min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4'
          >
            <Image
              src={resizeImage(item.image || '', 'md')}
              className='aspect-square rounded-2xl transition-opacity group-hover:opacity-80'
            />
            <p className='mt-3 line-clamp-2 text-14 leading-snug font-medium break-words text-neutral-800 dark:text-neutral-100'>
              {item.name}
            </p>
            {item.subtitle && (
              <p className='mt-1 truncate text-14 text-neutral-600 dark:text-neutral-300'>
                {item.subtitle}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
