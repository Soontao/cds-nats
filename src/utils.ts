/**
 * create a timer and wait it finished
 * 
 * @param timeout 
 * @returns 
 */
export async function sleep(timeout: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}
