# EduFlow — Build Android e iOS (Capacitor)

O app web continua funcionando exatamente como antes: todo código nativo é
carregado sob demanda e só ativa dentro do app empacotado.

## Passo a passo (na sua máquina)

1. Exporte o projeto para o GitHub e faça `git pull`.
2. `npm install`
3. `npx cap add android` e/ou `npx cap add ios`
4. `npx cap update android` / `npx cap update ios`
5. `npm run build`
6. `npx cap sync`
7. `npx cap run android` ou `npx cap run ios`

iOS exige macOS com Xcode. Android exige Android Studio.
Sempre que fizer `git pull`, rode `npm run build && npx cap sync`.

## Hot reload

`capacitor.config.ts` aponta `server.url` para o preview do Lovable, então o app
nativo recarrega direto do sandbox. Para gerar a versão de loja (offline, usando
`dist/`), remova o bloco `server` antes de `npm run build && npx cap sync`.

## Permissões nativas

### Android — `android/app/src/main/AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

### iOS — `ios/App/App/Info.plist`
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Usamos sua localização apenas para confirmar que você está no Restaurante Universitário ao relatar a fila.</string>
<key>NSCameraUsageDescription</key>
<string>A câmera é usada para fotografar o cardápio do RU e enviar seu atestado de matrícula.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Usada para escolher fotos de perfil, publicações e documentos acadêmicos.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Usada para salvar imagens geradas no app.</string>
```

## Onde o nativo é usado

- `src/lib/native.ts` — ponte única (status bar, splash, geolocalização, câmera).
- `src/hooks/useRu.tsx` → `requestPosition()` usa o plugin Geolocation no app nativo.
- `src/pages/Ru.tsx` → botão "Fotografar" usa a câmera nativa quando disponível.
