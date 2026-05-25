export default {
  expo: {
    name: "Controle de Restauração Financeira",
    slug: "controle-restauracao-financeira",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.bferreiracosta.financeiro",
    },
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    extra: {
      apiUrl: "https://backend-financeiro-ozii.onrender.com",
      eas: {
        projectId: "d33cc8aa-5bb7-45ce-bb32-1eb918f2f493",
      },
    },
  },
};
