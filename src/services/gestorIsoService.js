export async function getActivitiesByStatus() {
  try {
    const data = await gestorIsoFetch(`/api/projects`);

    return {
      ok: true,
      debug: true,
      sample: data
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack
    };
  }
}
