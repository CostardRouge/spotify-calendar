#!/usr/bin/env node
/**
 * Regenerates lib/demo-library.json — the fixture "Spotify library" served by
 * the API routes when DEMO_MODE=1 (used by the GitHub Pages showcase workflow
 * to boot the app and take real screenshots without a Spotify account).
 *
 * The raw album/song lists below were pulled from Apple's public music RSS
 * feeds (real releases, real artwork on the mzstatic CDN). Save-dates are
 * assigned deterministically (seeded PRNG) so the generated library is stable
 * across runs: dense in the most recent months, sparser going back.
 *
 * Usage: node scripts/build-demo-library.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Raw source data (name / artist / cover / feed genre)
// ---------------------------------------------------------------------------

const RAW_ALBUMS = [
  ["ICEMAN", "Drake", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["The Real Me", "Future", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8e/a0/75/8ea0757a-6859-9c50-e92b-944979cc0d53/196874557198.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["you seem pretty sad for a girl so in love", "Olivia Rodrigo", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1d/1b/f9/1d1bf9b1-44c6-9a6c-6ffb-c158488c06ce/26UMGIM39303.rgb.jpg/100x100bb.jpg", "Pop"],
  ["S.K.A.T.E.", "Rylo Rodriguez", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/64/e0/fd/64e0fdb9-9cf4-4e76-7493-cf9403d2dab3/26UMGIM85125.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Daughter from Hell", "Gracie Abrams", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4f/13/47/4f1347cf-9564-e8b6-523a-386202f4d265/26UMGIM54147.rgb.jpg/100x100bb.jpg", "Pop"],
  ["HABIBTI", "Drake", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c4/3b/89/c43b8964-a24e-b396-bd65-e5b45cabe039/26UMGIM63616.rgb.jpg/100x100bb.jpg", "R&B/Soul"],
  ["The Great Divide: The Last Of The Bugs", "Noah Kahan", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f9/aa/69/f9aa6992-40ca-a756-85ca-b27c48f7c720/26UMGIM02802.rgb.jpg/100x100bb.jpg", "Alternative"],
  ["Made You Think I Was Gone ...But", "Tory Lanez", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ba/18/1f/ba181f99-914c-e701-0e0f-e6f915d265ed/075679567727.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Oh yeah?", "Steve Lacy", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1c/b2/46/1cb246db-afae-a599-d377-44a7ea7267fa/196874346976.jpg/100x100bb.jpg", "Alternative"],
  ["Who Coppin", "Larry June", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/81/f5/5a/81f55ae2-0af8-dcaa-267a-d4f92993b5b2/199316582116_cover.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Set In Stone", "Rick Ross", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/93/78/93/937893d4-88b8-11cf-cb9e-590a972a71a1/656465218148_cover.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["I'm The Problem", "Morgan Wallen", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1e/ef/26/1eef2600-29f4-5423-3052-26874afd2947/25UMGIM46050.rgb.jpg/100x100bb.jpg", "Country"],
  ["Dandelion", "Ella Langley", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/26/35/03/26350323-d656-4817-49e6-4d658af8363a/196874332917.jpg/100x100bb.jpg", "Country"],
  ["Big Mama", "Latto", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/78/75/0f/78750f43-51a6-972d-b0e9-127fe0b00d85/196874450932.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["OCTANE", "Don Toliver", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e8/e5/c6/e8e5c690-a958-622e-eb62-0dce6059300e/075679599360.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Visitor (Deluxe)", "SIENNA SPIRO", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f4/e5/61/f4e561f5-3e73-68c7-7ca4-295ac5a063ed/26UMGIM51351.rgb.jpg/100x100bb.jpg", "Pop"],
  ["KPop Demon Hunters (Soundtrack from the Netflix Film)", "HUNTR/X & Saja Boys", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e1/15/42/e1154273-8ecd-5702-e6e6-597f28001681/25UMGIM82363.rgb.jpg/100x100bb.jpg", "K-Pop"],
  ["The Art of Loving", "Olivia Dean", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/e2/21/08e22164-7c0b-1522-818f-e0e74f62dc49/25UMGIM69703.rgb.jpg/100x100bb.jpg", "Pop"],
  ["ML2", "YoungBoy Never Broke Again", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/02/3d/d7/023dd7fa-39ab-fb09-9539-8367009649d3/26UMGIM82380.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["MAID OF HONOUR", "Drake", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/25/c0/e6/25c0e60b-5e99-58b2-6a52-821602141cce/26UMGIM63615.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["BROWN (The Chocolate Edition)", "Chris Brown", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/82/21/fd/8221fd58-b1bc-6469-a619-5091fe45b9c0/196874484470.jpg/100x100bb.jpg", "R&B/Soul"],
  ["CONFESSIONS II: Afterhours Edition", "Madonna", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1b/cd/11/1bcd1147-b559-3732-4994-18cb732c26e2/093624816508.jpg/100x100bb.jpg", "Pop"],
  ["DeBÍ TiRAR MáS FOToS", "Bad Bunny", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/90/5e/7e/905e7ed5-a8fa-a8f3-cd06-0028fdf3afaa/199066342442.jpg/100x100bb.jpg", "Latin"],
  ["One Thing At A Time", "Morgan Wallen", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/82/eb/b3/82ebb3c6-2bd4-31fd-0eb9-57667f3590e1/00602455239419_Cover.jpg/100x100bb.jpg", "Country"],
  ["The Life of a Showgirl", "Taylor Swift", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/58/8f/a9/588fa9a2-7cc5-f02c-9ce6-c986e0dc1c15/25UM1IM19577.rgb.jpg/100x100bb.jpg", "Pop"],
  ["Rich Off Pints 4", "Icewear Vezzo", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4c/99/c8/4c99c85d-2f43-a772-7900-a6896a7ab43b/66111.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Decades", "Motionless In White", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ec/c5/45/ecc54584-3fd6-446b-66f5-5eae301a3ea6/075679578396.jpg/100x100bb.jpg", "Metal"],
  ["xperiment", "Ken Carson", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f7/46/25/f746256d-c827-eb0d-32fe-de246f5553ec/26UMGIM78337.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Take Care (Deluxe Version)", "Drake", "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/74/fb/d3/74fbd365-bd52-23b4-604b-7f164407b0a9/00602527899107.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2011],
  ["Dangerous: The Double Album", "Morgan Wallen", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/54/3a/37/543a372b-ae7b-cca9-2a2b-16c5a6650d15/00602435458939_Cover.jpg/100x100bb.jpg", "Country", 2021],
  ["The Fall-Off", "J. Cole", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/de/94/4b/de944b82-ef5a-2f5b-4af7-e30c05ae1eac/26UMGIM15402.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Thriller", "Michael Jackson", "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/100x100bb.jpg", "Pop", 1982],
  ["PROJECT X", "Key Glock", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b5/67/c3/b567c37f-ca2d-66f5-1677-51075dcc6b8e/823375230014_Cover.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Hamilton: An American Musical (Original Broadway Cast Recording)", "Lin-Manuel Miranda", "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f3/99/31/f399318c-3f0d-bfd5-7a69-0b78b22a90df/075679921338.jpg/100x100bb.jpg", "Soundtrack", 2015],
  ["and all pride aside", "kwn", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a3/ec/ba/a3ecbaab-a561-6b80-b50f-b80788077694/196874385968.jpg/100x100bb.jpg", "R&B/Soul"],
  ["Fix Your Face", "Masego", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e3/0a/a7/e30aa798-8e78-47a1-97b1-6347dc799dd9/26UMGIM79547.rgb.jpg/100x100bb.jpg", "R&B/Soul"],
  ["ARIRANG", "BTS", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/83/cb/bc/83cbbc49-cfad-aeaf-3292-0dd428290d81/198704942365_Cover.jpg/100x100bb.jpg", "K-Pop"],
  ["Banks Of The Trinity", "Cody Johnson", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e2/d9/7a/e2d97a87-6ec6-99de-9a1f-31b86ce6e7c4/093624826613.jpg/100x100bb.jpg", "Country"],
  ["Tropicoqueta", "KAROL G", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1e/39/f5/1e39f58c-e5c1-6431-d6ed-d6c32e29d63f/25UMGIM79234.rgb.jpg/100x100bb.jpg", "Latin"],
  ["SWAG II", "Justin Bieber", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e0/cb/3e/e0cb3e1c-0dde-156d-d500-7943bc4ddebd/25UM1IM36272.rgb.jpg/100x100bb.jpg", "Pop"],
  ["Stick Season (Forever)", "Noah Kahan", "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/45/d1/c9/45d1c98b-8753-4e02-ba23-80e0d9bd43cc/24UMGIM07395.rgb.jpg/100x100bb.jpg", "Alternative", 2024],
  ["I NEVER LIKED YOU", "Future", "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/c1/27/d1/c127d12a-d259-dbd9-7d02-75056e376fb6/196589131805.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2022],
  ["BULLY - DELUXE", "Kanye West", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a4/ef/33/a4ef3370-c56d-97bc-efbf-34f3684b0884/712132042055_cover.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["The Odyssey (Original Motion Picture Soundtrack)", "Ludwig Göransson", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/85/28/de/8528de5e-6fbb-012a-0c8b-b75562b426e0/961.jpg/100x100bb.jpg", "Soundtrack"],
  ["$ome $exy $ongs 4 U", "PARTYNEXTDOOR & Drake", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/34/10/1e/34101e1f-f4b9-907a-ce47-3fba5b3ee5e8/50222.jpg/100x100bb.jpg", "R&B/Soul"],
  ["Kiss All The Time. Disco, Occasionally.", "Harry Styles", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/07/41/6a/07416a78-38b9-2d47-7ce8-8a52a44c510f/196874010112.jpg/100x100bb.jpg", "Pop"],
  ["The Romantic", "Bruno Mars", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ed/46/bf/ed46bf4e-7cb9-965a-54f3-03059977fe6c/075679589293.jpg/100x100bb.jpg", "Pop"],
  ["Foreign Tongues", "The Rolling Stones", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c2/c5/ad/c2c5ad0d-e9c9-041c-e803-a8466a23ce54/26UMGIM36901.rgb.jpg/100x100bb.jpg", "Rock"],
  ["Music, Fashion, Film", "Charli xcx", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/34/bd/5c/34bd5c11-fc93-a067-f495-12293a4bb9c1/075679573865.jpg/100x100bb.jpg", "Pop"],
  ["Man's Best Friend", "Sabrina Carpenter", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/cc/bc/ef/ccbcefb5-cf3a-1c55-0173-c37602827c7a/25UMGIM81699.rgb.jpg/100x100bb.jpg", "Pop"],
  ["The Way I Am", "Luke Combs", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4c/b6/e5/4cb6e5b1-2db0-88c0-f025-b79cad3b8fab/196873832111.jpg/100x100bb.jpg", "Country"],
  ["Moana (Original Motion Picture Soundtrack)", "Lin-Manuel Miranda & Mark Mancina", "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/35/24/1b/35241b7c-a539-1cd1-a855-f656cb46f67d/16UMGIM75345.rgb.jpg/100x100bb.jpg", "Soundtrack", 2016],
  ["(What's the Story) Morning Glory?", "Oasis", "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/04/92/e0/0492e08b-cbcc-9969-9ad6-8f5a0888068c/5051961007107.jpg/100x100bb.jpg", "Alternative", 1995],
  ["The Wow! Signal", "Muse", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/5f/8f/4b/5f8f4b32-9d11-b416-a6f9-3fb23e045dd0/5026854898216.jpg/100x100bb.jpg", "Alternative"],
  ["Rumours", "Fleetwood Mac", "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/100x100bb.jpg", "Rock", 1977],
  ["The Black Parade", "My Chemical Romance", "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/56/99/8a/56998a1c-efe7-fdf0-2b1d-e2da88d8df52/093624917724.jpg/100x100bb.jpg", "Alternative", 2006],
  ["M$NEY", "Asake", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/31/e4/eb/31e4ebf4-97bd-c193-59c7-1b72ed7ab53a/ticket.wlorjbae.jpg/100x100bb.jpg", "Afrobeats"],
  ["THIS MUSIC MAY CONTAIN HOPE.", "RAYE", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/50/05/10/5005106d-bb8a-32db-1172-f18405cf4a46/820200038890.jpg/100x100bb.jpg", "Pop"],
  ["÷ (Deluxe)", "Ed Sheeran", "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/18/3c/81/183c8163-7541-7043-2f0c-e55c23b265f5/190295851286.jpg/100x100bb.jpg", "Pop", 2017],
  ["Short n' Sweet (Deluxe)", "Sabrina Carpenter", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c9/a3/e9/c9a3e987-3952-a6ac-7975-680f2033e660/25UMGIM10586.rgb.jpg/100x100bb.jpg", "Pop", 2024],
  ["My Reckless Abandon", "Bella Kay", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ec/eb/23/eceb2396-35c1-679b-e302-2d0b7b274606/075679570116.jpg/100x100bb.jpg", "Alternative"],
  ["THE TORTURED POETS DEPARTMENT: THE ANTHOLOGY", "Taylor Swift", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a4/86/59/a486593a-53c9-1c2a-5122-8f25339f7359/24UMGIM44778.rgb.jpg/100x100bb.jpg", "Pop", 2024],
  ["Emotional Junglist", "Nia Archives", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/67/60/4867606c-1b5c-cd02-b6d3-cade77abd110/26UMGIM39397.rgb.jpg/100x100bb.jpg", "Electronic"],
  ["SOUR (Video Version)", "Olivia Rodrigo", "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/ce/63/06/ce6306bb-5830-af8f-8ebd-4eb7d3c14e1e/21UMGIM26092.rgb.jpg/100x100bb.jpg", "Pop", 2021],
  ["Hurry Up Tomorrow", "The Weeknd", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/f2/54/25f254a4-fb47-4149-0410-75ed463a77d1/ticket.qbamtedn.jpg/100x100bb.jpg", "R&B/Soul"],
  // French feed — adds genre & artist variety
  ["Destinée", "Aya Nakamura", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4f/21/52/4f215265-175c-f38f-f6c0-eb78536b70ed/5026854227283.jpg/100x100bb.jpg", "French Pop"],
  ["Oubliez-moi", "Jul", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/f8/67/fdf867fc-41a4-9ab9-cbc4-1a5b2b7d3483/cover.jpg/100x100bb.jpg", "French Rap"],
  ["Diamant Noir", "Werenoi", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8e/53/97/8e5397e2-ddb3-a026-2fdc-227df4ac4fc6/cover.jpg/100x100bb.jpg", "French Rap"],
  ["Blanco nemesis", "Booba", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/61/f6/7b/61f67b15-8c4a-8e32-4fbe-1876ebada695/26UMGIM63333.rgb.jpg/100x100bb.jpg", "French Rap"],
  ["BYAKUGAN", "Kaaris", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d3/4d/ee/d34dee89-3ffa-5f65-7011-4dbabd5bfcfd/26UMGIM55201.rgb.jpg/100x100bb.jpg", "French Rap"],
  ["ENERGY", "Franglish & KeBlack", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0d/8c/ba/0d8cba40-8c78-b2b6-4d33-8dad8ef244f4/cover.jpg/100x100bb.jpg", "French Rap"],
  ["Deux frères", "PNL", "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/45/65/a9/4565a97f-670e-b093-7e84-85eb99b4f969/cover.jpg/100x100bb.jpg", "French Rap", 2019],
  ["Grand Garçon", "PLK", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2e/16/d8/2e16d80e-bcc5-8990-74a2-d1768ee23330/3596975053396_cover.jpg/100x100bb.jpg", "French Rap"],
  ["Jefe", "Ninho", "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/5d/b4/53/5db45349-6035-32c8-1faf-0c7e47d62d22/190296368370.jpg/100x100bb.jpg", "French Rap", 2021],
  ["Destin", "Ninho", "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ab/c5/ea/abc5eab6-1a33-3910-6f96-3954d76c5815/190295460259.jpg/100x100bb.jpg", "French Rap", 2019],
  ["Dans la légende", "PNL", "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/49/69/4d/49694dd1-bea5-e484-01da-45475b44ab60/cover.jpg/100x100bb.jpg", "French Rap", 2016],
  ["ICEMAN", "Drake", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Carré", "Werenoi", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/11/9b/68/119b6873-ea4b-4b0d-29ee-a6451c800da7/cover.jpg/100x100bb.jpg", "French Rap"],
  ["SUMMERGIRL", "Eva", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/86/09/80/860980ac-8932-9648-1f3d-ea9377a87dd3/26UMGIM62460.rgb.jpg/100x100bb.jpg", "French Pop"],
  ["A LA VIE A LA MORT", "SDM", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/64/46/95/64469515-0230-b26c-69cf-5db61f5ea879/24UMGIM72197.rgb.jpg/100x100bb.jpg", "French Rap", 2024],
  ["Pyramide 2", "Werenoi", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/5c/bf/09/5cbf094e-b227-f4fb-3b4f-82b3857f7196/cover.jpg/100x100bb.jpg", "French Rap"],
  ["Ipséité", "Damso", "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2d/8b/e6/2d8be617-440c-5c4f-7a05-b960e880b548/17UMGIM88656.rgb.jpg/100x100bb.jpg", "French Rap", 2017],
  ["Le monde chico", "PNL", "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/22/41/48/224148e9-ce34-a594-aa79-109e9f1f8ed8/cover.jpg/100x100bb.jpg", "French Rap", 2015],
  ["Comme prévu", "Ninho", "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/6c/c7/3b/6cc73bbb-563b-2dc9-4c9b-5880eac6bf73/190295820558.jpg/100x100bb.jpg", "French Rap", 2017],
  ["Telegram", "Werenoi", "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/d5/94/e1/d594e1d5-414a-782d-6ccd-5716b2ff477b/cover.jpg/100x100bb.jpg", "French Rap"],
  ["HateLove", "Joé Dwèt Filé", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fc/12/68/fc1268f7-c959-b244-c62f-020d91294088/cover.jpg/100x100bb.jpg", "R&B/Soul"],
  ["Mamma Mia! (The Movie Soundtrack)", "Benny Andersson & Björn Ulvaeus", "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/c5/3d/97/c53d978b-4433-743e-7a4b-e01942cd33ee/00602517784154.rgb.jpg/100x100bb.jpg", "Soundtrack", 2008],
  ["The Greatest Showman (Original Motion Picture Soundtrack)", "Benj Pasek & Justin Paul", "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/cf/91/b0/cf91b07c-aca2-4511-e61c-63d13b8d1117/075679868770.jpg/100x100bb.jpg", "Soundtrack", 2017],
];

const RAW_TRACKS = [
  ["Dead Fresh", "Lil Baby", "Dead Fresh - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/74/80/37/748037d7-71c1-feff-4d38-3ef0a25578b6/26UMGIM85451.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Choosin' Texas", "Ella Langley", "Choosin' Texas - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e2/91/4d/e2914d0a-7f1d-f04c-fbf4-c50b38548838/196873638690.jpg/100x100bb.jpg", "Country"],
  ["Janice STFU", "Drake", "ICEMAN", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Be Her", "Ella Langley", "Be Her - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a1/ba/64/a1ba6484-f462-1b88-ddff-d4c014d5f265/196874018361.jpg/100x100bb.jpg", "Country"],
  ["Shabang", "Drake", "ICEMAN", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["I Can't Love You Anymore", "Ella Langley & Morgan Wallen", "I Can't Love You Anymore - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d9/7a/6e/d97a6e25-ef5c-0c26-64e9-266c18641a57/196874324103.jpg/100x100bb.jpg", "Country"],
  ["Spend Dat", "Yung Miami", "Spend Dat - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bd/54/8d/bd548d85-4c33-2432-ecd8-e26f0585bdfd/26UMGIM41443.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["stupid song", "Olivia Rodrigo", "you seem pretty sad for a girl so in love", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1d/1b/f9/1d1bf9b1-44c6-9a6c-6ffb-c158488c06ce/26UMGIM39303.rgb.jpg/100x100bb.jpg", "Pop"],
  ["20 Cigarettes", "Morgan Wallen", "I'm The Problem", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1e/ef/26/1eef2600-29f4-5423-3052-26874afd2947/25UMGIM46050.jpg/100x100bb.jpg", "Country"],
  ["Ran To Atlanta", "Drake, Future & Molly Santana", "ICEMAN", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["the cure", "Olivia Rodrigo", "you seem pretty sad for a girl so in love", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1d/1b/f9/1d1bf9b1-44c6-9a6c-6ffb-c158488c06ce/26UMGIM39303.rgb.jpg/100x100bb.jpg", "Pop"],
  ["hate that i made you love me", "Ariana Grande", "hate that i made you love me - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7e/e6/82/7ee682bd-1b17-6adc-be63-b5af1bdff369/26UMGIM51126.jpg/100x100bb.jpg", "Pop"],
  ["Cinderella (feat. Ty Dolla $ign)", "Mac Miller", "The Divine Feminine", "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/cc/4d/33cc4d85-e92a-b171-1b72-4dc882ce2359/093624918844.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2016],
  ["Freestyle", "Lil Baby", "Too Hard", "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/93/e7/aa/93e7aa59-da8b-15bc-2992-5803f70fe8fa/17UM1IM55478.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2017],
  ["Dai Dai", "Shakira & Burna Boy", "Dai Dai - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/61/49/8d/61498ded-f0dc-227d-cd1d-2051b5d9f195/196874328590.jpg/100x100bb.jpg", "Pop"],
  ["In A Minute", "Lil Baby", "In A Minute - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/9f/c0/99/9fc09958-180d-e66a-bbf7-9462289435f6/22UM1IM13098.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2022],
  ["WAIT FOR U (feat. Drake & Tems)", "Future", "I NEVER LIKED YOU", "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/65/f2/06/65f2067b-a8ea-239c-c219-8e0f0282dcea/196589073693.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2022],
  ["MORNING DEW (DONK)", "Beyoncé", "MORNING DEW (DONK) - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3f/65/3d/3f653d87-197c-084c-dca2-0c6e0ca742c9/196874580721.jpg/100x100bb.jpg", "Pop"],
  ["Wonderwall", "Oasis", "(What's the Story) Morning Glory?", "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/34/2e/cb/342ecb17-ef19-816a-4ce5-e60b9ceec161/5051961073164.jpg/100x100bb.jpg", "Alternative", 1995],
  ["Boston", "STELLA LEFTY", "Boston - Single", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7c/de/5e/7cde5e7a-612d-9714-d34c-1eb234c85ebb/810129961546.jpg/100x100bb.jpg", "Country"],
  ["Best I Ever Had", "Drake", "So Far Gone", "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7e/b0/35/7eb0353b-8f25-32dd-5f5e-71d9ed700247/00602577524004.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2009],
  ["Whisper My Name", "Drake", "ICEMAN", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Man I Need", "Olivia Dean", "The Art of Loving", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/e2/21/08e22164-7c0b-1522-818f-e0e74f62dc49/25UMGIM69703.jpg/100x100bb.jpg", "Pop"],
  ["Last Night", "Morgan Wallen", "One Thing At A Time", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/82/eb/b3/82ebb3c6-2bd4-31fd-0eb9-57667f3590e1/00602455239419_Cover.jpg/100x100bb.jpg", "Country", 2023],
  ["I Had Some Help (feat. Morgan Wallen)", "Post Malone", "F-1 Trillion", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e1/b7/09/e1b7098f-d6e1-2b18-fd6f-8390110908eb/24UMGIM50612.jpg/100x100bb.jpg", "Country", 2024],
  ["March Madness", "Future", "56 Nights", "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/f4/5c/bc/f45cbc87-8e29-b069-39d8-71db2fc0d1e3/886448381211.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2015],
  ["Wants and Needs (feat. Lil Baby)", "Drake", "Scary Hours 2", "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/63/2a/34/632a3488-d104-3ff1-dc02-4ed86f58ed05/21UMGIM18577.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2021],
  ["Konnichiwa", "Future", "The Real Me", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8e/a0/75/8ea0757a-6859-9c50-e92b-944979cc0d53/196874557198.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["I'm Spent", "Drake & Loe Shimmy", "HABIBTI", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c4/3b/89/c43b8964-a24e-b396-bd65-e5b45cabe039/26UMGIM63616.jpg/100x100bb.jpg", "R&B/Soul"],
  ["California Girls", "Future", "The Real Me", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8e/a0/75/8ea0757a-6859-9c50-e92b-944979cc0d53/196874557198.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["What I Want", "Morgan Wallen & Tate McRae", "I'm The Problem", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1e/ef/26/1eef2600-29f4-5423-3052-26874afd2947/25UMGIM46050.jpg/100x100bb.jpg", "Country"],
  ["Frozen", "Lil Baby", "It's Only Me", "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/4c/5c/d2/4c5cd2e1-2244-2527-3ea3-2003ee734428/22UMGIM45519.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2022],
  ["Billie Jean", "Michael Jackson", "Thriller", "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/100x100bb.jpg", "Pop", 1982],
  ["E85", "Don Toliver", "OCTANE", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e8/e5/c6/e8e5c690-a958-622e-eb62-0dce6059300e/075679599360.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["National Treasures", "Drake", "ICEMAN", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/b9/06/35b90629-a873-14f8-4789-ffc324960038/26UMGIM63614.rgb.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["weren't for the wind", "Ella Langley", "hungover", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ef/f1/65/eff16551-2b83-202a-f923-a655a57c61b8/196872452563.jpg/100x100bb.jpg", "Country", 2024],
  ["Thinkin' Bout Me", "Morgan Wallen", "One Thing At A Time", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/82/eb/b3/82ebb3c6-2bd4-31fd-0eb9-57667f3590e1/00602455239419_Cover.jpg/100x100bb.jpg", "Country", 2023],
  ["Snow in Skyami", "Future", "The Real Me", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8e/a0/75/8ea0757a-6859-9c50-e92b-944979cc0d53/196874557198.jpg/100x100bb.jpg", "Hip-Hop/Rap"],
  ["Stick Talk", "Future", "DS2", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0a/46/ab/0a46ab3a-2415-0659-2cc2-f3f173144bd5/886445328530.jpg/100x100bb.jpg", "Hip-Hop/Rap", 2015],
  ["Cowgirls (feat. ERNEST)", "Morgan Wallen", "One Thing At A Time", "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/82/eb/b3/82ebb3c6-2bd4-31fd-0eb9-57667f3590e1/00602455239419_Cover.jpg/100x100bb.jpg", "Country", 2023],
  ["I Knew It, I Knew You", "Taylor Swift", "Toy Story 5 (Original Soundtrack)", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/35/6c/34356cb4-bd0b-3bac-b118-1a6d7264dc64/26UMGIM69942.jpg/100x100bb.jpg", "Soundtrack"],
  ["Be By You", "Luke Combs", "The Way I Am", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4c/b6/e5/4cb6e5b1-2db0-88c0-f025-b79cad3b8fab/196873832111.jpg/100x100bb.jpg", "Country"],
  ["Wasted On You", "Morgan Wallen", "Dangerous: The Double Album", "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/05/ab/6805abb2-10d1-35cb-aa84-71386b285b7d/00602435514642_Cover.jpg/100x100bb.jpg", "Country", 2021],
];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Deterministic PRNG so every run produces the same library. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260723);

const GENRE_TAGS = {
  "Hip-Hop/Rap": ["hip hop", "rap"],
  Pop: ["pop"],
  Country: ["country"],
  Alternative: ["alternative", "indie"],
  "R&B/Soul": ["r&b", "soul"],
  Latin: ["latin", "reggaeton"],
  Metal: ["metal"],
  Electronic: ["electronic", "jungle"],
  "K-Pop": ["k-pop"],
  Soundtrack: ["soundtrack"],
  Rock: ["rock", "classic rock"],
  Afrobeats: ["afrobeats"],
  "French Rap": ["french rap", "rap français"],
  "French Pop": ["french pop"],
};

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const splitArtists = (s) =>
  s
    .split(/\s*(?:,|&|\bfeat\.\s)\s*/)
    .filter(Boolean)
    .map((name) => ({ id: "demo-" + slug(name), name }));

const upscale = (url) => url.replace("100x100bb", "400x400bb");

// The library spans 2025-01-10 .. 2026-07-22, biased toward recent months so
// the calendar opens on a lively month. A quadratic bias does the job.
const START = Date.UTC(2025, 0, 10);
const END = Date.UTC(2026, 6, 22); // July 22, 2026
function randomDay() {
  const u = rand();
  const bias = 1 - u * u; // more mass near END
  return new Date(START + bias * (END - START));
}

function toEntry(raw, kind, index) {
  const isTrack = kind === "track";
  const [name, artist, ...rest] = raw;
  const albumName = isTrack ? raw[2] : undefined;
  const cover = isTrack ? raw[3] : raw[2];
  const genreKey = isTrack ? raw[4] : raw[3];
  const fixedYear = isTrack ? raw[5] : raw[4];

  const d = randomDay();
  // Noon UTC keeps the local date stable across European/US timezones.
  const dateKey = d.toISOString().slice(0, 10);
  const addedAt = `${dateKey}T${String(8 + Math.floor(rand() * 14)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00Z`;
  const year =
    typeof fixedYear === "number"
      ? fixedYear
      : rand() < 0.75
        ? 2023 + Math.floor(rand() * 4)
        : 1998 + Math.floor(rand() * 25);

  return {
    id: (isTrack ? "t_demo-t" : "demo-a") + index,
    kind,
    name,
    ...(albumName ? { albumName } : {}),
    addedAt,
    dateKey,
    year: Math.min(year, 2026),
    cover: upscale(cover),
    artists: splitArtists(artist),
    genres: GENRE_TAGS[genreKey] ?? [slug(genreKey).replace(/-/g, " ")],
  };
}

// Dedupe albums by name+artist (the US/GB/FR feeds overlap).
const seen = new Set();
const albums = [];
for (const raw of RAW_ALBUMS) {
  const key = raw[0] + "::" + raw[1];
  if (seen.has(key)) continue;
  seen.add(key);
  albums.push(toEntry(raw, "album", albums.length + 1));
}
const tracks = RAW_TRACKS.map((raw, i) => toEntry(raw, "track", i + 1));

// Guarantee the most recent month is dense: re-date the newest quarter of the
// library onto July 2026 (days 1-22), a few items per day.
function densify(list, count, monthDays) {
  const sorted = [...list].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  for (let i = 0; i < Math.min(count, sorted.length); i++) {
    const day = monthDays[Math.floor(rand() * monthDays.length)];
    const dateKey = `2026-07-${String(day).padStart(2, "0")}`;
    sorted[i].dateKey = dateKey;
    sorted[i].addedAt = `${dateKey}T${String(9 + Math.floor(rand() * 12)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}:00Z`;
  }
}
const JULY_DAYS = [1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22];
densify(albums, 26, JULY_DAYS);
densify(tracks, 14, JULY_DAYS);

const byNewest = (a, b) => (a.addedAt < b.addedAt ? 1 : -1);
albums.sort(byNewest);
tracks.sort(byNewest);

const out = { albums, tracks };
const dest = join(dirname(fileURLToPath(import.meta.url)), "../lib/demo-library.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${albums.length} albums + ${tracks.length} tracks -> ${dest}`);
