import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/LOGO NEGRO.jpeg" type="image/png" />
        <link rel="apple-touch-icon" href="/LOGO NEGRO.jpeg" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
