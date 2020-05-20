import Compare from './compare'
import startup from './startup'
import AtomPubRequest from './atomPubRequest'
import FileRequest from './fileRequest'

export default async function (options: ReadOptions) {
  const { atomPubRequest, fileRequest } = await startup()

  const remoteArticles = await atomPubRequest.fetchs()
  const localArticles = await fileRequest.reads(options)

  await uploadNewerArticles( remoteArticles, localArticles, atomPubRequest, fileRequest )
}

const uploadNewerArticles = async (
  remoteArticles: Article[],
  localArticles: Article[],
  atomPubRequest: AtomPubRequest,
  fileRequest: FileRequest
) => {
  return await Promise.all( localArticles.map( async localArticle => {
    const conflictRemoteArticle = remoteArticles.find( remote => 
      remote.id !== localArticle.id && remote.customUrl === localArticle.customUrl
    )
    if( conflictRemoteArticle !== undefined ){
      // Conflict: idの違うカスタムURLの同じ記事が既にリモートに存在する
      console.log(`Skip to upload/update, because of CONFLICT`)
      console.log(` local:  ${fileRequest.customUrl2filePath(localArticle.customUrl)}`)
      console.log(` remote: ${atomPubRequest.fullUrl(conflictRemoteArticle.customUrl)}`)
      console.log(` If you want to overwrite the remote article, Please delete it.`)
      return
    }

    if( localArticle.id === undefined ){
      // post new article
      const newArticle = await atomPubRequest.post(localArticle)
      // 投稿に成功した内容でローカルのファイルを上書き
      await fileRequest.delete(localArticle)
      await fileRequest.write(newArticle)
      console.log(`Upload: ${atomPubRequest.fullUrl(localArticle.customUrl)}`)
      return
    }

    const remoteArticle = remoteArticles.find( remote =>
      remote.id === localArticle.id
    )
    if( remoteArticle === undefined ) {
      console.log(`Skip to update, because of invalid id`)
      console.log(` local:  ${fileRequest.customUrl2filePath(localArticle.customUrl)}`)
      console.log(` If you want to upload the local file, Please delete id in the file's front-matter.`)
      return
    }

    const compare = new Compare(localArticle, remoteArticle)
    if(compare.remoteIsNew() || compare.sameWithoutEditedDate()) {
      return
    }

    // Update article
    const newArticle = await atomPubRequest.put(localArticle)
    // 投稿に成功した内容でローカルのファイルを上書き
    await fileRequest.delete(localArticle)
    await fileRequest.write(newArticle)
    console.log(`Update: ${atomPubRequest.fullUrl(localArticle.customUrl)}`)
  }))
}
