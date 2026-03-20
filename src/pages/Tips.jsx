import { useEffect, useLayoutEffect, useState } from 'react';
import PostDetail from '../components/PostDetails/PostDetails';
import { Error, NetworkWifi1Bar, Verified } from '@mui/icons-material';
import { NavLink } from 'react-router-dom';
import { getTips } from '../firebase';
import Loader from '../components/Loader/Loader';
import AppHelmet from '../components/AppHelmet';

export default function Tips({ userData }) {
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState([]);
  const [days, setDays] = useState(null);
  const [currentDate, setCurrentDate] = useState(null)
  const [tipsPerPage] = useState(25);
  const [active, setActive] = useState(null)
  const [category, setCategory] = useState('premium')
  const [isPremium, setIsPremium] = useState(false);

  const options = { year: 'numeric', month: 'long' };
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-US', options);

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US');
  }

  useEffect(() => {
    if (userData !== null) {
      if (userData.email === 'kkibetkkoir@gmail.com' || userData.email === 'arovanzgamez@gmail.com') {
        setIsPremium(true)
      } else {
        setIsPremium(userData.isPremium)
      }
    }
  }, [userData])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  });

  const [isOnline] = useState(() => {
    return navigator.onLine
  })

  useEffect(() => {
    getTips(tipsPerPage, setTips, setLoading, formatDate(currentDate));
  }, [isOnline, tipsPerPage, currentDate]);

  useEffect(() => {
    let dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      let date = new Date(today);
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    setDays(dates.reverse());
  }, []);

  useEffect(() => {
    days && setCurrentDate(days[days.length - 1])
  }, [days]);

  useEffect(() => {
    if (tips.length > 0) {
      setActive(tips.filter((tip) => (category === 'free') ? (tip.premium === false) : (tip.premium === true))[0])
    }
  }, [tips]);

  useEffect(() => {
    loading && setTimeout(() => {
      setLoading(false);
    }, 2000);
  }, [loading]);

  const handleReload = () => {
    getTips(tipsPerPage, setTips, setLoading, formatDate(currentDate));
  }

  const returnDate = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const handleClick = async (tip) => {
    setActive(tip)
    document.querySelector(".post-detail").classList.add("active")
  };

  return (
    <div className="tips">
      <AppHelmet title={"Powerking Tips"} location={'/'} />
      <div className='container'>
        <div className="filter-wrapper">
          <p>{formattedDate}</p>
          <select onChange={(e) => setCategory(e.target.value)} value={category}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        
        <div className="filter">
          {
            days && days.map((day) => {
              return (
                <button 
                  className={`btn-filter ${(currentDate === day) && 'active'}`} 
                  onClick={() => setCurrentDate(day)} 
                  key={days.indexOf(day)} 
                  aria-label={day}
                >
                  <span>{returnDate(day).split(" ")[1]?.substring(0, 3) || ''}</span>
                  <span>{returnDate(day).split(" ")[0]}</span>
                </button>
              )
            })
          }
        </div>

        <table className="tips-table wrapper">
          <thead>
            <tr>
              <th>TIME</th>
              <th>HOME</th>
              <th>AWAY</th>
              <th>TIP</th>
              <th>ODDS</th>
              <th>RESULTS</th>
            </tr>
          </thead>
          <tbody>
            {
              (tips.length > 0) && tips.filter((tip) => 
                (category === 'free') ? (tip.premium === false) : (tip.premium === true)
              ).map(tip => {
                return (
                  <tr key={tip.id} onClick={() => handleClick(tip)}>
                    <td>{tip.time}</td>
                    <td>
                      {(!isPremium && (tip.premium && (tip.date === formatDate(days?.[days.length - 1])))) 
                        ? "Join VIP To View" 
                        : tip.home}
                    </td>
                    <td>
                      {(!isPremium && (tip.premium && (tip.date === formatDate(days?.[days.length - 1])))) 
                        ? "Closed" 
                        : tip.away}
                    </td>
                    <td>{tip.pick}</td>
                    <td>{tip.odd}</td>
                    <td>
                      {tip.won === 'won' ? (
                        <span className='won'>
                          <p>Won</p>
                          <Verified className='icon' />
                        </span>
                      ) : tip.status === "pending" ? (
                        <span>?-?</span>
                      ) : (
                        <span className='lost'>
                          <p>Lost</p>
                          <Error className='icon' />
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>

        <div className="wrapper">
          {
            (!isOnline && (tips.length === 0) && !loading) && 
            <div className='no-network'>
              <h1>Nothing Yet!</h1>
              <p>This could be a network issue. Check you internet and try again.</p>
              <NetworkWifi1Bar className='wifi' />
              <NavLink className="btn" onClick={handleReload}>Reload</NavLink>
            </div>
          }

          {
            ((!tips.length > 0) && loading) && <Loader />
          }
        </div>
      </div>

      {
        active && <PostDetail data={active} userData={userData} />
      }
    </div>
  )
}
