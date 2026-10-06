import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

const WebView: any = RNWebView;
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Contacts from 'expo-contacts';
import { HTML } from './faizaaHtml';

const BASE = 'https://faizaa.local/';

function readSaved(): string | null {
  try {
    const f = new File(Paths.document, 'faizaa.json');
    return f.exists ? f.textSync() : null;
  } catch {
    return null;
  }
}

function writeSaved(data: unknown) {
  try {
    const f = new File(Paths.document, 'faizaa.json');
    if (!f.exists) f.create();
    f.write(JSON.stringify(data));
  } catch {}
}

async function exportData(data: unknown) {
  try {
    const f = new File(Paths.cache, 'faizaa-data.json');
    if (!f.exists) f.create();
    f.write(JSON.stringify(data, null, 2));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Export Faizaa data' });
    }
  } catch {}
}

export default function App() {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const ref = useRef<any>(null);

  useEffect(() => {
    setSaved(readSaved());
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ref.current?.injectJavaScript('window.__back && window.__back(); true;');
      return true;
    });
    return () => sub.remove();
  }, []);

  if (saved === undefined) return <View style={styles.root} />;

  const pre = `window.__FAIZAA_INIT__ = ${saved ? `JSON.parse(${JSON.stringify(saved)})` : 'null'}; true;`;

  const sendContacts = async () => {
    const reply = (js: string) => ref.current?.injectJavaScript(js + '; true;');
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        reply(`window.__contactsErr(${JSON.stringify('Contacts permission was not given. Allow it in Settings, then try again.')})`);
        return;
      }
      const res = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Company,
          Contacts.Fields.JobTitle,
          Contacts.Fields.Birthday,
        ],
      });
      const list = (res.data || []).map((c: any) => {
        const b = c.birthday;
        const mm = b && b.month != null ? String(b.month + 1).padStart(2, '0') : '';
        const dd = b && b.day != null ? String(b.day).padStart(2, '0') : '';
        return {
          name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' '),
          phone: c.phoneNumbers && c.phoneNumbers[0] ? c.phoneNumbers[0].number : '',
          email: c.emails && c.emails[0] ? c.emails[0].email : '',
          company: c.company || '',
          title: c.jobTitle || '',
          bday: mm && dd ? `${mm}-${dd}` : '',
        };
      });
      reply(`window.__contacts(${JSON.stringify(list)})`);
    } catch (err) {
      reply(`window.__contactsErr(${JSON.stringify('Could not read contacts.')})`);
    }
  };

  const onMessage = (e: any) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.t === 'save') writeSaved(m.d);
      else if (m.t === 'export') exportData(m.d);
      else if (m.t === 'exit') BackHandler.exitApp();
      else if (m.t === 'contacts') sendContacts();
    } catch {}
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <WebView
          ref={ref}
          style={styles.web}
          source={{ html: HTML, baseUrl: BASE }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          overScrollMode="never"
          injectedJavaScriptBeforeContentLoaded={pre}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req: any) => {
            const u = req.url;
            if (u.startsWith(BASE) || u.startsWith('about:') || u.startsWith('data:')) return true;
            Linking.openURL(u).catch(() => {});
            return false;
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050816' },
  web: { flex: 1, backgroundColor: '#050816' },
});
