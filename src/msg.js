import axios from 'axios'

// const name = 'kakaotalk'
const KMS_API_ENTRYPOINT = 'http://api.noti.daumkakao.io'
// const KMS_API_SEND_GROUP = '/send/group/kakaotalk'
const KMS_API_SEND_PERSONAL = '/send/personal/kakaotalk'

/*
const SEND_TARGET = {
  GROUP: 'group',
  PERSONAL: 'personal'
}
*/

export default async () => {
  const to = 'joon.k'
  const msg = '코드리뷰 언능해라!'
  const test = await axios.post(`${KMS_API_ENTRYPOINT}${KMS_API_SEND_PERSONAL}`, { to, msg })
  console.log(test)
}
