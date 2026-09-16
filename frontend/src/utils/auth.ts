// buat mempermudah manggil fungsi auth dari local storage/session storage
export const getCurrentUser = () => {
  const user = localStorage.getItem("user");

  if (!user) {
    return null;
  }

  return JSON.parse(user);
};

export const getUserRole = () => {
  const user = getCurrentUser();

  return user?.role || null;
};

export const isSuperUser = () => {
  return getUserRole() === "super_user";
};