import { NextResponse } from 'next/server';
import https from 'node:https';
import tls from 'node:tls';

/* 받아둔 중간 인증서 — tools/certs/*.pem 을 그대로 넣었습니다.
   Vercel 에는 tools/ 가 안 올라가서 여기 적습니다. 공개 인증서라 비밀이 아닙니다 */
const 인증서: Record<string, string> = {"joongangjeil.co.kr":"-----BEGIN CERTIFICATE-----\nMIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf\nMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD\nEy1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw\nHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY\nMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp\nYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B\nAQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq\nRPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH\n12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja\nEMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm\nM64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv\n38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB\npXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn\n2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN\nxx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk\nlfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw\nDgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw\nVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv\nUHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH\nAQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp\nZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF\nBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA\nYtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8\nze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d\nq1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF\nh2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH\n5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD\n4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd\nunQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536\nWrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l\n7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW\nr8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh\nJEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=\n-----END CERTIFICATE-----\n","recruit.gnuh.co.kr":"-----BEGIN CERTIFICATE-----\nMIIFjjCCBHagAwIBAgIQcCosoce0HIWpncOmISmyLzANBgkqhkiG9w0BAQsFADBt\nMQswCQYDVQQGEwJDSDEQMA4GA1UEChMHV0lTZUtleTEiMCAGA1UECxMZT0lTVEUg\nRm91bmRhdGlvbiBFbmRvcnNlZDEoMCYGA1UEAxMfT0lTVEUgV0lTZUtleSBHbG9i\nYWwgUm9vdCBHQiBDQTAeFw0yNTA1MjcxNTEwMzRaFw0zMDA1MjYxNTEwMzRaMFEx\nCzAJBgNVBAYTAkNIMR0wGwYDVQQKDBRUdXJpbmdTaWduIEdsb2JhbCBTQTEjMCEG\nA1UEAwwaVHVyaW5nU2lnbiBSU0EgU2VjdXJlIENBIDIwggIiMA0GCSqGSIb3DQEB\nAQUAA4ICDwAwggIKAoICAQDGDBcFU6l+Hs5OUzBVjDQP8xGhdPG7xvNPu2Q5FF1f\nL4IOIIYnx2E3ZFVbYf4a6d/8q4HFlWLT98BIPGo3nlsZiyaKb6MKMGONE5/4DfMk\nzn+JkQaggOmXNLhn0hbezFJOJaYBcCroBZmDyOKbHRSHnBDZuG8Fx5UqbSG3Zlic\nywd4ET0CZXL/QZCcJzRJ6OMyndQpvmxbCq8TUwbqT4FwFDOwigqBPNlEgjSje0vc\n3Xg7KUOgcHs9NI26Vo72YR/uiA9N/0gMfum0DLp/31vhIHw68LC/7cU/4Rp6yYaY\nc8OfyhRuwfsMHWTXpAroHqbK8zlK4ZFOaTv+6MeFHnADyYRLdLl4cPTDmLUZFbyo\n3Ec/NFepKYP/hFM0Fo7wFHMg1QsLSOD9KcQzxOkAhggX5bHd3DvQZyo3g3EnC6l0\nFFQ4UwTI2qLKXpVN8EUfh3HSJmbVsQoyUdmbOz+qjtIjHAP2mIwip6AvE3DWA28E\nK09fLTCbCbP/NBAfZAWbfzSeombpwib5pLUQ6/0FzMRw8dE6jm5t5L5INBXaUUCx\nwXM9BJxMc+gqjxRJD5SEbyK0dFR74n2nkzzUS83GyFJXkfYDOnYBUN0kGtUzn4bt\nRLdQ00+xewgFVMPGXTeQMK0VpavOb0uFcu4ZhLA28B2iT8XWc4Not1Bj84+5O50K\nEwIDAQABo4IBRDCCAUAwEgYDVR0TAQH/BAgwBgEB/wIBADAfBgNVHSMEGDAWgBQ1\nD8g2Y17io+z5O2YVzlFS45GaPTBrBggrBgEFBQcBAQRfMF0wNgYIKwYBBQUHMAKG\nKmh0dHA6Ly9wdWJsaWMud2lzZWtleS5jb20vY3J0L293Z3JnYmNhLmNlcjAjBggr\nBgEFBQcwAYYXaHR0cDovL29jc3Aud2lzZWtleS5jb20wEQYDVR0gBAowCDAGBgRV\nHSAAMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATA7BgNVHR8ENDAyMDCg\nLqAshipodHRwOi8vcHVibGljLndpc2VrZXkuY29tL2NybC9vd2dyZ2JjYS5jcmww\nHQYDVR0OBBYEFM3OdTxWi2FRu9+xUPmb6hymFzMRMA4GA1UdDwEB/wQEAwIBBjAN\nBgkqhkiG9w0BAQsFAAOCAQEAbjvOB6/tTaX0YG/8sPytIvU6nEWuq2Zfxl7FMMB7\nwAm7IPPf5MSTXcc8mmPh97YDj/A6N3jOf09G7IJEGYo7Sf9948ZhL6czKmByyKhU\nr3yCEmVV/+MyhTvhc5aJIG6dnADXw8C1lMwEt6gzMolsNyQ3gY6slPxZ2xUEcPZi\nwm9veB9aR+QfcUl7UHQHpfC7EoeelSir7AfcvLdbseaqM5GeWlFWmsCH7SweFybv\nTjz94Rfsafz5fEL2EaApecOUK3bLh9mO6cgL7n8yryrUKG5hY6D4OirSYpYJvS6y\nu2wLYijDNYa2wMqRFdIoMB/7NxDyVQ3lfc7Kj50d33TUsQ==\n-----END CERTIFICATE-----\n","sungso.com":"-----BEGIN CERTIFICATE-----\nMIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf\nMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD\nEy1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw\nHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY\nMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp\nYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B\nAQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq\nRPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH\n12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja\nEMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm\nM64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv\n38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB\npXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn\n2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN\nxx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk\nlfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw\nDgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw\nVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv\nUHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH\nAQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp\nZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF\nBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA\nYtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8\nze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d\nq1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF\nh2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH\n5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD\n4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd\nunQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536\nWrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l\n7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW\nr8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh\nJEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=\n-----END CERTIFICATE-----\n","www.drbs.or.kr":"-----BEGIN CERTIFICATE-----\nMIIFjTCCA3WgAwIBAgIRAIN9TriekS/nLK07x2kt3CAwDQYJKoZIhvcNAQELBQAw\nTDEgMB4GA1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjYxEzARBgNVBAoTCkds\nb2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMjUwNTIxMDIzNjUyWhcN\nMjcwNTIxMDAwMDAwWjBVMQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2ln\nbiBudi1zYTErMCkGA1UEAxMiR2xvYmFsU2lnbiBHQ0MgUjYgQWxwaGFTU0wgQ0Eg\nMjAyNTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ/oiu0Bviq52UUE\nADbFWmgu3rC7KDSMoorLN1Wd03McG3Z1aP71DlPCE33838r72Dfuj5M9LXfiQLJp\nAu6MwNExmKOzothw4x0zGf5oBYyrCMGm3fBpLPafwYQ3MchBOWMTbf83rKUPLH48\nKCJ0MnU8GUl8oA/J81wIvbbKPuNrFf6hvJDccjzc4NyxLz3A89zjV2g5whCg5O0u\n9YX4Zxk9JHuc/LvllOJO4waAYLjbWBJkz3rV3ts1SmSYnJqmyRTIjXwQgRvhEYqt\nDbRskt0W7M6cPwCze3GTBN2UHNpHkMs3YmVxku68I0aOQn5+uz//fDROP3z1Z/7I\nAPteRtECAwEAAaOCAV8wggFbMA4GA1UdDwEB/wQEAwIBhjAdBgNVHSUEFjAUBggr\nBgEFBQcDAQYIKwYBBQUHAwIwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU\nxbSTj28r3B5Iv7cQMIXO0bK7SC0wHwYDVR0jBBgwFoAUrmwFo5MT4qLn4tcc1sfw\nf8hnU6AwewYIKwYBBQUHAQEEbzBtMC4GCCsGAQUFBzABhiJodHRwOi8vb2NzcDIu\nZ2xvYmFsc2lnbi5jb20vcm9vdHI2MDsGCCsGAQUFBzAChi9odHRwOi8vc2VjdXJl\nLmdsb2JhbHNpZ24uY29tL2NhY2VydC9yb290LXI2LmNydDA2BgNVHR8ELzAtMCug\nKaAnhiVodHRwOi8vY3JsLmdsb2JhbHNpZ24uY29tL3Jvb3QtcjYuY3JsMCEGA1Ud\nIAQaMBgwCAYGZ4EMAQIBMAwGCisGAQQBoDIKAQMwDQYJKoZIhvcNAQELBQADggIB\nAB/uvBuZf4CiuSahwiXn4geF52roAH+6jxsEPTXTfb7bbeMDXsYgRRsOTNA70ruZ\nTnz5DfFMuBhNoFhIFb0qR1izdy6VkdKOqFPNF2dOFI1EcnY9l2ory9mrzHqVbrL4\nvzUd17FLUVyjTVU7PAv4nxyhnO1GTeT83YlrdRF31NyR6bvZVTEERHmpbWSgeveJ\nLRtaMzlGWiLZ8IwkH7o6GH3jp/KPtDW4Npu8w64HrRZdN2pqQhi7+YKwfHM7H+2U\ndM1BGN0sjOWMVbMSB9MtCsleS2Mb7TRZEbOHxECJLLIluQypZr7Pol3+hAqrhyKI\nk+6y+Da0NeDuWxW59Ku4NvClqW1UFX1SpfNGhzVfp/CH+vPM1tySomx2jE0EnYZu\nGwVucXPBsp5nUWqUV9+143glVuS7GTg9hFPjNBInn17HbCoIIQIOzj5Vd9bK3A9U\nGxXNpwenDHEalCsD/4eQYDHPhFE7sNe0D/OXu+FAM02VZkARx37Jp4bDdujvgL9P\nvZPR3wThvDN1CTU8Bc3xea3yKFAraKcPZLkhReQUAm2VpR+HSJRPlUpYizlF9WkL\nh3KcAVCBJWvnOkVwxyU5QJMcnwW95JlOtx+9100GL99jHE5rs3gXp7F4bg8H01QT\n9jVOhBBmQ7nQoXuwI0tqal2QUqZz3eeu62CU7xBwtfYR\n-----END CERTIFICATE-----\n","www.dswhosp.co.kr":"-----BEGIN CERTIFICATE-----\nMIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf\nMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD\nEy1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw\nHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY\nMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp\nYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B\nAQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq\nRPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH\n12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja\nEMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm\nM64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv\n38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB\npXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn\n2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN\nxx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk\nlfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw\nDgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw\nVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv\nUHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH\nAQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp\nZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF\nBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA\nYtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8\nze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d\nq1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF\nh2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH\n5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD\n4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd\nunQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536\nWrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l\n7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW\nr8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh\nJEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=\n-----END CERTIFICATE-----\n","www.hallahosp.co.kr":"-----BEGIN CERTIFICATE-----\nMIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf\nMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD\nEy1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw\nHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY\nMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp\nYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B\nAQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j\nlYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD\nu+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc\nFYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s\nyy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX\ngZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB\nWRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x\nbt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2\nO44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk\nlfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw\nDgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw\nVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv\nUHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH\nAQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp\nZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF\nBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA\nBZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr\n7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR\nMQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc\nxlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod\ne/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE\nwLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ\nMuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/\niPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib\nQXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw\nq1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX\n58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=\n-----END CERTIFICATE-----\n","www.smhospital.kr":"-----BEGIN CERTIFICATE-----\nMIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf\nMQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD\nEy1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw\nHhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY\nMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp\nYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B\nAQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq\nRPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH\n12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja\nEMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm\nM64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv\n38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB\npXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn\n2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN\nxx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk\nlfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw\nDgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI\nKwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw\nVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv\nUHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH\nAQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp\nZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF\nBzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA\nYtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8\nze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d\nq1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF\nh2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH\n5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD\n4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd\nunQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536\nWrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l\n7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW\nr8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh\nJEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=\n-----END CERTIFICATE-----\n","www.sunhospital.com":"-----BEGIN CERTIFICATE-----\nMIIFjTCCA3WgAwIBAgIRAIN9TriekS/nLK07x2kt3CAwDQYJKoZIhvcNAQELBQAw\nTDEgMB4GA1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjYxEzARBgNVBAoTCkds\nb2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMjUwNTIxMDIzNjUyWhcN\nMjcwNTIxMDAwMDAwWjBVMQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2ln\nbiBudi1zYTErMCkGA1UEAxMiR2xvYmFsU2lnbiBHQ0MgUjYgQWxwaGFTU0wgQ0Eg\nMjAyNTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ/oiu0Bviq52UUE\nADbFWmgu3rC7KDSMoorLN1Wd03McG3Z1aP71DlPCE33838r72Dfuj5M9LXfiQLJp\nAu6MwNExmKOzothw4x0zGf5oBYyrCMGm3fBpLPafwYQ3MchBOWMTbf83rKUPLH48\nKCJ0MnU8GUl8oA/J81wIvbbKPuNrFf6hvJDccjzc4NyxLz3A89zjV2g5whCg5O0u\n9YX4Zxk9JHuc/LvllOJO4waAYLjbWBJkz3rV3ts1SmSYnJqmyRTIjXwQgRvhEYqt\nDbRskt0W7M6cPwCze3GTBN2UHNpHkMs3YmVxku68I0aOQn5+uz//fDROP3z1Z/7I\nAPteRtECAwEAAaOCAV8wggFbMA4GA1UdDwEB/wQEAwIBhjAdBgNVHSUEFjAUBggr\nBgEFBQcDAQYIKwYBBQUHAwIwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU\nxbSTj28r3B5Iv7cQMIXO0bK7SC0wHwYDVR0jBBgwFoAUrmwFo5MT4qLn4tcc1sfw\nf8hnU6AwewYIKwYBBQUHAQEEbzBtMC4GCCsGAQUFBzABhiJodHRwOi8vb2NzcDIu\nZ2xvYmFsc2lnbi5jb20vcm9vdHI2MDsGCCsGAQUFBzAChi9odHRwOi8vc2VjdXJl\nLmdsb2JhbHNpZ24uY29tL2NhY2VydC9yb290LXI2LmNydDA2BgNVHR8ELzAtMCug\nKaAnhiVodHRwOi8vY3JsLmdsb2JhbHNpZ24uY29tL3Jvb3QtcjYuY3JsMCEGA1Ud\nIAQaMBgwCAYGZ4EMAQIBMAwGCisGAQQBoDIKAQMwDQYJKoZIhvcNAQELBQADggIB\nAB/uvBuZf4CiuSahwiXn4geF52roAH+6jxsEPTXTfb7bbeMDXsYgRRsOTNA70ruZ\nTnz5DfFMuBhNoFhIFb0qR1izdy6VkdKOqFPNF2dOFI1EcnY9l2ory9mrzHqVbrL4\nvzUd17FLUVyjTVU7PAv4nxyhnO1GTeT83YlrdRF31NyR6bvZVTEERHmpbWSgeveJ\nLRtaMzlGWiLZ8IwkH7o6GH3jp/KPtDW4Npu8w64HrRZdN2pqQhi7+YKwfHM7H+2U\ndM1BGN0sjOWMVbMSB9MtCsleS2Mb7TRZEbOHxECJLLIluQypZr7Pol3+hAqrhyKI\nk+6y+Da0NeDuWxW59Ku4NvClqW1UFX1SpfNGhzVfp/CH+vPM1tySomx2jE0EnYZu\nGwVucXPBsp5nUWqUV9+143glVuS7GTg9hFPjNBInn17HbCoIIQIOzj5Vd9bK3A9U\nGxXNpwenDHEalCsD/4eQYDHPhFE7sNe0D/OXu+FAM02VZkARx37Jp4bDdujvgL9P\nvZPR3wThvDN1CTU8Bc3xea3yKFAraKcPZLkhReQUAm2VpR+HSJRPlUpYizlF9WkL\nh3KcAVCBJWvnOkVwxyU5QJMcnwW95JlOtx+9100GL99jHE5rs3gXp7F4bg8H01QT\n9jVOhBBmQ7nQoXuwI0tqal2QUqZz3eeu62CU7xBwtfYR\n-----END CERTIFICATE-----\n","www.yuseongsunhospital.com":"-----BEGIN CERTIFICATE-----\nMIIFjTCCA3WgAwIBAgIRAIN9TriekS/nLK07x2kt3CAwDQYJKoZIhvcNAQELBQAw\nTDEgMB4GA1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjYxEzARBgNVBAoTCkds\nb2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMjUwNTIxMDIzNjUyWhcN\nMjcwNTIxMDAwMDAwWjBVMQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2ln\nbiBudi1zYTErMCkGA1UEAxMiR2xvYmFsU2lnbiBHQ0MgUjYgQWxwaGFTU0wgQ0Eg\nMjAyNTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ/oiu0Bviq52UUE\nADbFWmgu3rC7KDSMoorLN1Wd03McG3Z1aP71DlPCE33838r72Dfuj5M9LXfiQLJp\nAu6MwNExmKOzothw4x0zGf5oBYyrCMGm3fBpLPafwYQ3MchBOWMTbf83rKUPLH48\nKCJ0MnU8GUl8oA/J81wIvbbKPuNrFf6hvJDccjzc4NyxLz3A89zjV2g5whCg5O0u\n9YX4Zxk9JHuc/LvllOJO4waAYLjbWBJkz3rV3ts1SmSYnJqmyRTIjXwQgRvhEYqt\nDbRskt0W7M6cPwCze3GTBN2UHNpHkMs3YmVxku68I0aOQn5+uz//fDROP3z1Z/7I\nAPteRtECAwEAAaOCAV8wggFbMA4GA1UdDwEB/wQEAwIBhjAdBgNVHSUEFjAUBggr\nBgEFBQcDAQYIKwYBBQUHAwIwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU\nxbSTj28r3B5Iv7cQMIXO0bK7SC0wHwYDVR0jBBgwFoAUrmwFo5MT4qLn4tcc1sfw\nf8hnU6AwewYIKwYBBQUHAQEEbzBtMC4GCCsGAQUFBzABhiJodHRwOi8vb2NzcDIu\nZ2xvYmFsc2lnbi5jb20vcm9vdHI2MDsGCCsGAQUFBzAChi9odHRwOi8vc2VjdXJl\nLmdsb2JhbHNpZ24uY29tL2NhY2VydC9yb290LXI2LmNydDA2BgNVHR8ELzAtMCug\nKaAnhiVodHRwOi8vY3JsLmdsb2JhbHNpZ24uY29tL3Jvb3QtcjYuY3JsMCEGA1Ud\nIAQaMBgwCAYGZ4EMAQIBMAwGCisGAQQBoDIKAQMwDQYJKoZIhvcNAQELBQADggIB\nAB/uvBuZf4CiuSahwiXn4geF52roAH+6jxsEPTXTfb7bbeMDXsYgRRsOTNA70ruZ\nTnz5DfFMuBhNoFhIFb0qR1izdy6VkdKOqFPNF2dOFI1EcnY9l2ory9mrzHqVbrL4\nvzUd17FLUVyjTVU7PAv4nxyhnO1GTeT83YlrdRF31NyR6bvZVTEERHmpbWSgeveJ\nLRtaMzlGWiLZ8IwkH7o6GH3jp/KPtDW4Npu8w64HrRZdN2pqQhi7+YKwfHM7H+2U\ndM1BGN0sjOWMVbMSB9MtCsleS2Mb7TRZEbOHxECJLLIluQypZr7Pol3+hAqrhyKI\nk+6y+Da0NeDuWxW59Ku4NvClqW1UFX1SpfNGhzVfp/CH+vPM1tySomx2jE0EnYZu\nGwVucXPBsp5nUWqUV9+143glVuS7GTg9hFPjNBInn17HbCoIIQIOzj5Vd9bK3A9U\nGxXNpwenDHEalCsD/4eQYDHPhFE7sNe0D/OXu+FAM02VZkARx37Jp4bDdujvgL9P\nvZPR3wThvDN1CTU8Bc3xea3yKFAraKcPZLkhReQUAm2VpR+HSJRPlUpYizlF9WkL\nh3KcAVCBJWvnOkVwxyU5QJMcnwW95JlOtx+9100GL99jHE5rs3gXp7F4bg8H01QT\n9jVOhBBmQ7nQoXuwI0tqal2QUqZz3eeu62CU7xBwtfYR\n-----END CERTIFICATE-----\n"};


/* 시험용 — 서울 리전에서 「막혔던 병원」 이 열리는지 봅니다 (2026-09-28).
 *
 * ⚠ **운영에 남기지 않습니다.** 시험이 끝나면 이 파일을 지우고 다시 올립니다.
 *
 * ── 왜 ────────────────────────────────────────────────────────
 * 구글(Apps Script)·GitHub Actions 에서 막히던 병원 37곳입니다.
 * 집 컴퓨터(한국 IP)에서는 전부 열렸고, Vercel 서울에서도 네 곳이 열렸습니다.
 * 이제 **나머지 전부**가 서울에서 열리는지 봅니다.
 * 안 열리는 곳이 나오면 AWS 대역 자체를 막는 곳일 수 있어 따로 목록을 뺍니다.
 *
 * ── 이 파일이 지키는 것 ───────────────────────────────────────
 * · 아무 데도 안 씁니다 (시트·DB·저장소)
 * · 비밀값을 안 씁니다 · 로그인·인증 우회를 하지 않습니다
 * · 공개된 채용 게시판만 한 번씩 읽습니다
 *
 * ── 「몇 건 왔다」 만 찍지 않습니다 ────────────────────────────
 * 곳마다 상태코드·응답 원문 앞 1,200자·실패하면 오류 원문을 그대로 담습니다.
 *
 * 명단은 gas/wage.js 의 HOSP_SITES 에서 `off` 가 적힌 줄을 뽑아 만든 것입니다.
 * (gas/ 는 저장소 밖이라 Vercel 에 없습니다. 그래서 여기 적어 둡니다)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type 곳 = { 이름: string; 까닭: string; url: string; enc?: string };

const 볼곳: 곳[] = [
  { 이름: "충청남도 천안의료원", 까닭: "주소못찾음", url: "https://www.camc.or.kr/board/syfsx" },
  { 이름: "대동병원", 까닭: "403", url: "https://www.ddh.co.kr/board/%EA%B3%A0%EA%B0%9D%EC%84%9C%EB%B9%84%EC%8A%A4/%EC%B1%84%EC%9A%A9%EC%86%8C%EC%8B%9D" },
  { 이름: "대전한국병원", 까닭: "403", url: "https://djh.kr/community/recruit" },
  { 이름: "대진의료재단 분당제생병원", 까닭: "주소못찾음", url: "https://www.dmc.or.kr/recruit/recruit/list.do" },
  { 이름: "동아병원", 까닭: "해외차단", url: "https://dongahospital.co.kr/bbs/board.php?bo_table=0403" },
  { 이름: "의료법인 오성의료재단 동군산병원", 까닭: "주소못찾음", url: "https://www.donggunsanhosp.co.kr/kor/recruit.cs" },
  { 이름: "의료법인 녹산의료재단동수원병원", 까닭: "방화벽406", url: "https://www.dswhosp.co.kr/support/recruit.php" },
  { 이름: "의료법인숭인의료재단 김해복음병원", 까닭: "403", url: "http://www.gimhaebokum.com/05_community/community_07.php?code=employ", enc: "EUC-KR" },
  { 이름: "녹색병원", 까닭: "프록시차단", url: "https://www.greenhospital.co.kr/bbs/board.php?tbl=bbs65" },
  { 이름: "의료법인 광혜의료재단 광혜병원", 까닭: "403", url: "https://www.gwanghyehospital.com/bbs/board.php?bo_table=K050500" },
  { 이름: "창원한마음병원", 까닭: "403", url: "https://recruit.hanheart.co.kr/02_recruit/01_recruit.php" },
  { 이름: "한마음병원", 까닭: "주소못찾음", url: "http://www.hanmaeum.jeju.kr/board/list.do?tblNm=Hire" },
  { 이름: "의료법인 명인의료재단 화홍병원", 까닭: "403", url: "https://www.hwahonghospital.com/page/intro/news/hire.php" },
  { 이름: "의료법인한마음의료재단 여수제일병원", 까닭: "403", url: "https://jeilhp.com/recruit" },
  { 이름: "의료법인 중앙의료재단 중앙병원", 까닭: "403", url: "https://www.jeju-jungangh.com/kor/wpbbs/list.php?wpboard=recruit" },
  { 이름: "제주특별자치도 서귀포의료원", 까닭: "타임아웃", url: "https://www.jjsmc.or.kr/bbs/board.php?bo_table=4_5_1_1" },
  { 이름: "전주고려병원", 까닭: "주소못찾음", url: "http://www.jkhospital.co.kr/bbs/board.php?bo_table=sub06_01" },
  { 이름: "의료법인 건명의료재단 중앙제일병원", 까닭: "방화벽406", url: "https://joongangjeil.co.kr/introduction/recruit.php" },
  { 이름: "전라남도 순천의료원", 까닭: "403", url: "https://jsmc.or.kr/?contentId=c9f0f895fb98ab9159f51fd0297e236d" },
  { 이름: "광주기독병원", 까닭: "주소못찾음", url: "https://www.kch.or.kr/user/board/lists/board_cd/notice" },
  { 이름: "메디인병원", 까닭: "403", url: "https://www.medi-in.co.kr/backend/api/recruit?page=1&limit=20" },
  { 이름: "의료법인동춘의료재단문경제일병원", 까닭: "403", url: "https://www.mgjh.co.kr/bbs/board.php?bo_table=job_01" },
  { 이름: "경상남도마산의료원", 까닭: "주소못찾음", url: "https://www.mmc.or.kr/board/list?id=12&menuId=112" },
  { 이름: "목포시의료원", 까닭: "302고리", url: "https://mokpomc.or.kr/bbs/board.php?bo_table=5_4" },
  { 이름: "의료법인대송의료재단 무안병원", 까닭: "403", url: "http://www.muangh.co.kr/bbs/board.php?bo_table=recruit" },
  { 이름: "온재병원", 까닭: "403", url: "http://www.xn--hc0bs21a7cp8rsyh23j.com/04_customer/customer_07.php" },
  { 이름: "의료법인 양진의료재단 평택성모병원", 까닭: "프록시차단", url: "https://www.ptsm.co.kr/bbs/board.php?tbl=bbs52" },
  { 이름: "(의)성세의료재단 뉴성민병원", 까닭: "주소못찾음", url: "http://www.smgh.co.kr/smgh/main2/board?menuID=service&menuSubID=recruit" },
  { 이름: "의료법인 일심의료재단 포천우리병원", 까닭: "403", url: "http://swoori.co.kr/bbs/board.php?bo_table=recruit" },
  { 이름: "의료법인자인의료재단(더자인병원)", 까닭: "403", url: "https://www.the-jain.co.kr/bbs/board.php?bo_table=ot" },
  { 이름: "울산병원", 까닭: "403", url: "https://ush.kr/bbs/board.php?bo_table=incur_notice" },
  { 이름: "원광대학교 산본병원", 까닭: "403", url: "https://www.wmcsb.co.kr/bbs/board.php?bo_table=hospnews_04" },
  { 이름: "영도병원", 까닭: "403", url: "https://www.ydh.co.kr/bbs/bbs/board.php?bo_table=recruit" },
  { 이름: "의료법인거명의료재단 영광기독병원", 까닭: "403", url: "https://www.ygch.co.kr/?page_id=3917" },
  { 이름: "근로복지공단 태백병원", 까닭: "GitHub400", url: "https://www.comwel.or.kr/taebaek/info/rcrt.jsp" },
  { 이름: "나주종합병원", 까닭: "3연속실패", url: "http://www.ngh.co.kr/cms/bbs/cms.php?dk_cms=comm_02" },
  { 이름: "창원파티마병원", 까닭: "3연속실패", url: "https://www.fatimahosp.co.kr/api/article/3?instNo=1&boardNo=3&startIndex=1&pageRow=20" },];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function 머리글(차수: number, url: string): Record<string, string> {
  if (차수 === 1) return { 'User-Agent': UA };
  let ref = '';
  try { ref = url.split('/').slice(0, 3).join('/') + '/'; } catch { /* 주소가 이상하면 빈 채로 */ }
  return {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
    Referer: ref,
  };
}

type 한번 = { code: number | null; 자수: number; 본문: string; 왜: string; ms: number };

async function 두드리기(s: 곳, 차수: number): Promise<한번> {
  const t0 = Date.now();
  try {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), 8000);
    const r = await fetch(s.url, { headers: 머리글(차수, s.url), redirect: 'follow', signal: c.signal, cache: 'no-store' });
    clearTimeout(tm);
    const buf = Buffer.from(await r.arrayBuffer());
    /* EUC-KR 쪽이 많습니다. UTF-8 로 읽으면 한글이 깨져 「채용」 이 0번으로 세집니다 */
    const ct = r.headers.get('content-type') || '';
    const cs = s.enc || (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html: string;
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    return { code: r.status, 자수: html.length, 본문: html, 왜: '', ms: Date.now() - t0 };
  } catch (e: unknown) {
    const err = e as { cause?: { code?: string }; name?: string; message?: string };
    return {
      code: null, 자수: 0, 본문: '',
      왜: String(err?.cause?.code || err?.name || err?.message || e).slice(0, 200),
      ms: Date.now() - t0,
    };
  }
}

/* 3차 — 수집기(tools/certs/index.mjs)와 **같은 방식**으로 한 번 더.
 *
 * ── 왜 ────────────────────────────────────────────────────────
 * 1·2차는 평범한 fetch 라서 이런 것들이 「못 엶」 으로 나옵니다 —
 *   UNABLE_TO_VERIFY_LEAF_SIGNATURE  서버가 중간 인증서를 안 보냄
 *   ERR_SSL_DH_KEY_TOO_SMALL         옛 암호를 쓰는 서버
 * 둘 다 **IP 차단이 아닙니다.** TLS 악수까지 갔다는 뜻이라 서버는 답한 것입니다.
 * 우리 수집기는 이미 이걸 풉니다. 서울에서도 풀리는지 봐야 「AWS 대역 차단」 과
 * 갈라낼 수 있습니다.
 *
 * ⚠ 인증서 검증(rejectUnauthorized)은 **끄지 않습니다.**
 *   받아둔 중간 인증서를 뿌리 묶음에 **더할** 뿐입니다. */
function 붙여받기(url: string): Promise<한번> {
  const t0 = Date.now();
  return new Promise((done) => {
    let u: URL;
    try { u = new URL(url); } catch { return done({ code: null, 자수: 0, 본문: '', 왜: '주소가 아닙니다', ms: 0 }); }
    if (u.protocol !== 'https:') return done({ code: null, 자수: 0, 본문: '', 왜: 'https 가 아니라 3차를 건너뜁니다', ms: 0 });
    const pem = 인증서[u.hostname];
    const req = https.request({
      host: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'GET',
      headers: { ...머리글(2, url), Host: u.hostname }, servername: u.hostname,
      rejectUnauthorized: true,                                   // ← 끄지 않습니다
      ...(pem ? { ca: [...tls.rootCertificates, pem] } : {}),      // ← 사슬만 이어줍니다
      ciphers: 'DEFAULT@SECLEVEL=1', minVersion: 'TLSv1',          // ← 옛 암호 허용
    }, (res) => {
      const 덩이: Buffer[] = [];
      res.on('data', (c: Buffer) => 덩이.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(덩이);
        const ct = String(res.headers['content-type'] || '');
        const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
          || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
        let html: string;
        try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
        done({ code: res.statusCode ?? null, 자수: html.length, 본문: html, 왜: '', ms: Date.now() - t0 });
      });
    });
    req.on('error', (e: NodeJS.ErrnoException) => done({
      code: null, 자수: 0, 본문: '', 왜: String(e.code || e.message).slice(0, 120), ms: Date.now() - t0,
    }));
    req.setTimeout(8000, () => { req.destroy(); done({ code: null, 자수: 0, 본문: '', 왜: 'TIMEOUT', ms: Date.now() - t0 }); });
    req.end();
  });
}

async function 한곳(s: 곳) {
  const a = await 두드리기(s, 1);
  const b = a.code === 200 ? null : await 두드리기(s, 2);
  /* 1·2차가 SSL 쪽 까닭으로 죽었으면 수집기와 같은 방식으로 한 번 더 */
  const ssl한가 = /SSL|TLS|CERT|DH_KEY|EPROTO/i.test((b || a).왜 || '');
  const c = (!(b && b.code === 200) && a.code !== 200 && ssl한가) ? await 붙여받기(s.url) : null;
  const 최종 = (c && c.code === 200) ? c : (b && b.code === 200) ? b : a;
  const 글 = 최종.본문.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  /* 「열렸다」 는 200 만으로는 모자랍니다 — 403 안내문도 200 으로 오는 곳이 있습니다.
     알맹이가 있고 채용 관련 말이 있어야 진짜 열린 것입니다 */
  const 채용말 = (글.match(/채용|모집|공고/g) || []).length;
  return {
    이름: s.이름, 막힌까닭: s.까닭, 주소: s.url,
    성공: 최종.code === 200 && 글.length > 300,
    상태코드: 최종.code,
    '채용·모집·공고_몇번': 채용말,
    '1차_UA만': a.code !== null ? 'HTTP ' + a.code + ' · ' + a.자수 + '자 · ' + a.ms + 'ms'
      : '못 엶 · ' + a.왜 + ' · ' + a.ms + 'ms',
    '2차_브라우저흉내': b === null ? '(1차에 열려 안 함)'
      : (b.code !== null ? 'HTTP ' + b.code + ' · ' + b.자수 + '자 · ' + b.ms + 'ms'
        : '못 엶 · ' + b.왜 + ' · ' + b.ms + 'ms'),
    '3차_인증서붙여': c === null ? '(안 함 — SSL 까닭이 아니었습니다)'
      : (c.code !== null ? 'HTTP ' + c.code + ' · ' + c.자수 + '자 · ' + c.ms + 'ms'
        : '못 엶 · ' + c.왜 + ' · ' + c.ms + 'ms'),
    머리글로_풀렸나: !!(b && b.code === 200),
    인증서로_풀렸나: !!(c && c.code === 200),
    /* 왜 막혔는지 갈래를 지어 둡니다 — 「AWS 대역 차단」 과 「우리 쪽 SSL」 은 다른 일입니다 */
    막힌갈래: 최종.code === 200 ? ''
      : /limited to users in Korea|Firewall|Forbidden|차단/i.test((최종.본문 || '').slice(0, 400)) ? 'IP 보고 거절'
        : /SSL|TLS|CERT|DH_KEY/i.test(최종.왜 || '') ? 'SSL (서버는 답했습니다 — IP 차단 아님)'
          : /TIMEOUT|ECONNREFUSED|ENOTFOUND/i.test(최종.왜 || '') ? '아예 못 붙음'
            : 'HTTP ' + 최종.code,
    오류_원문: 최종.왜 || '',
    응답_원문_앞1200자: (글 || '(빈 본문)').slice(0, 1200),
  };
}

export async function GET() {
  const 리전 = process.env.VERCEL_REGION || '(모름)';
  const t0 = Date.now();
  /* ⚠ 12곳씩 나눠 돌렸더니 **60초를 넘겨 504** 가 났습니다 (2026-09-28).
     묶음마다 그 안에서 가장 느린 곳을 끝까지 기다리는데, 3차까지 붙이니 넘쳤습니다.
     한꺼번에 던지면 전체가 「가장 느린 한 곳」 만큼만 걸립니다.
     37곳이라 상대 서버에도 무리가 아닙니다 — 한 곳당 한두 번입니다 */
  const 결과 = await Promise.all(볼곳.map(한곳));
  const 열림 = 결과.filter((r) => r.성공);
  const 막힘 = 결과.filter((r) => !r.성공);
  return NextResponse.json({
    잰때: new Date().toISOString(),
    '이_함수가_돈_리전': 리전,
    '서울인가': 리전 === 'icn1',
    본_곳: 볼곳.length,
    열린_곳: 열림.length,
    '아직_막힌_곳': 막힘.length,
    걸린초: Math.round((Date.now() - t0) / 100) / 10,
    한줄: 리전 !== 'icn1'
      ? '⚠ 서울(icn1)이 아니라 ' + 리전 + ' 에서 돌았습니다 — 이 결과로는 판단할 수 없습니다'
      : 막힘.length === 0 ? '서울에서는 ' + 볼곳.length + '곳 다 열립니다'
        : 막힘.length + '곳이 아직 막힙니다 — AWS 대역을 막는 곳일 수 있습니다',
    '아직_막힌_곳_목록': 막힘.map((r) => ({
      이름: r.이름, 전에막힌까닭: r.막힌까닭, 막힌갈래: r.막힌갈래, 상태코드: r.상태코드,
      오류: r.오류_원문, 주소: r.주소,
      본문앞200: r.응답_원문_앞1200자.slice(0, 200),
    })),
    결과,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
